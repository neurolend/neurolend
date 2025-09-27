// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import "./ZeroGConfig.sol";

/**
 * @title neurolend
 * @dev A decentralized lending protocol for 0G Chain with Pyth Network price feeds
 * @notice This contract enables peer-to-peer lending with collateral backing using real-time Pyth prices
 */
contract neurolend is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ============ Enums ============

    enum LoanStatus {
        Pending,
        Active,
        Repaid,
        Defaulted,
        Cancelled
    }

    // ============ Structs ============

    struct Loan {
        uint256 id;
        address lender;
        address borrower;
        address tokenAddress;
        uint256 amount;
        uint256 interestRate; // Basis points (e.g., 500 = 5%)
        uint256 duration; // Duration in seconds
        address collateralAddress;
        uint256 collateralAmount;
        uint256 startTime;
        LoanStatus status;
        uint256 minCollateralRatioBPS; // Minimum required collateralization ratio at loan acceptance (e.g., 15000 for 150%)
        uint256 liquidationThresholdBPS; // Collateralization ratio below which loan can be liquidated (e.g., 12000 for 120%)
        uint256 maxPriceStaleness; // Maximum age of oracle price data (in seconds)
        uint256 repaidAmount; // Amount already repaid (for partial repayments)
    }

    // ============ Constants ============

    // Liquidation fee for liquidators (1% = 100 basis points)
    uint256 public constant LIQUIDATION_FEE_BPS = 100;

    // ============ State Variables ============

    uint256 public nextLoanId = 1;

    // Mappings for efficient loan management
    mapping(uint256 => Loan) public loans;
    mapping(address => uint256[]) public lenderLoans;
    mapping(address => uint256[]) public borrowerLoans;

    // Array to efficiently query open loan offers
    uint256[] public activeLoanOfferIds;

    // Mapping to track position of loan ID in activeLoanOfferIds array for O(1) removal
    mapping(uint256 => uint256) private activeLoanOfferIndex;

    // Pyth Network contract for price feeds
    IPyth public immutable pyth;

    // Mapping to store Pyth price feed IDs for tokens
    mapping(address => bytes32) public tokenPriceFeedIds;

    // ============ Events ============

    event LoanCreated(
        uint256 indexed loanId,
        address indexed lender,
        address indexed tokenAddress,
        uint256 amount,
        uint256 interestRate,
        uint256 duration,
        address collateralAddress,
        uint256 collateralAmount,
        uint256 minCollateralRatioBPS,
        uint256 liquidationThresholdBPS,
        uint256 maxPriceStaleness
    );

    event LoanAccepted(
        uint256 indexed loanId,
        address indexed borrower,
        uint256 timestamp,
        uint256 initialCollateralRatio
    );

    event LoanRepaid(
        uint256 indexed loanId,
        address indexed borrower,
        uint256 repaymentAmount,
        uint256 timestamp
    );

    event LoanLiquidated(
        uint256 indexed loanId,
        address indexed liquidator,
        uint256 collateralClaimedByLender,
        uint256 liquidatorReward,
        uint256 timestamp
    );

    event LoanOfferCancelled(
        uint256 indexed loanId,
        address indexed lender,
        uint256 timestamp
    );

    event LoanOfferRemoved(uint256 indexed loanId, string reason);

    event PriceFeedSet(address indexed tokenAddress, bytes32 indexed feedId);

    event CollateralAdded(
        uint256 indexed loanId,
        address indexed borrower,
        uint256 amount,
        uint256 newCollateralRatio,
        uint256 timestamp
    );

    event CollateralRemoved(
        uint256 indexed loanId,
        address indexed borrower,
        uint256 amount,
        uint256 newCollateralRatio,
        uint256 timestamp
    );

    event PartialRepayment(
        uint256 indexed loanId,
        address indexed borrower,
        uint256 repaymentAmount,
        uint256 totalRepaidAmount,
        uint256 remainingAmount,
        uint256 timestamp
    );

    event PriceUpdatePaid(
        uint256 indexed loanId,
        uint256 updateFee,
        uint256 timestamp
    );

    // ============ Constructor ============

    constructor() Ownable(msg.sender) {
        // Initialize Pyth contract with 0G Chain address
        pyth = IPyth(ZeroGConfig.PYTH_CONTRACT);
        _setupSupportedTokens();
    }

    /**
     * @notice Initialize all supported 0G Chain tokens and their Pyth price feed IDs
     * @dev Called during contract deployment to set up supported tokens
     */
    function _setupSupportedTokens() internal {
        (address[] memory tokens, bytes32[] memory priceFeeds) = ZeroGConfig
            .getSupportedTokens();

        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i] != address(0) && priceFeeds[i] != bytes32(0)) {
                tokenPriceFeedIds[tokens[i]] = priceFeeds[i];
                emit PriceFeedSet(tokens[i], priceFeeds[i]);
            }
        }
    }

    // ============ Administration Functions ============

    /**
     * @notice Sets the Pyth price feed ID for a given ERC20 token
     * @dev Only callable by the contract owner
     * @param _tokenAddress The address of the ERC20 token
     * @param _feedId The Pyth price feed ID for this token
     */
    function setTokenPriceFeedId(
        address _tokenAddress,
        bytes32 _feedId
    ) external onlyOwner {
        require(_tokenAddress != address(0), "Invalid token address");
        require(_feedId != bytes32(0), "Invalid feed ID");
        tokenPriceFeedIds[_tokenAddress] = _feedId;
        emit PriceFeedSet(_tokenAddress, _feedId);
    }

    /**
     * @notice Get recommended collateral parameters for a loan asset and collateral asset pair
     * @param loanAsset The token being borrowed
     * @param collateralAsset The token being used as collateral
     * @return minRatio Recommended minimum collateral ratio in basis points
     * @return liquidationThreshold Recommended liquidation threshold in basis points
     * @return maxStaleness Recommended maximum price staleness in seconds
     */
    function getRecommendedParameters(
        address loanAsset,
        address collateralAsset
    )
        external
        pure
        returns (
            uint256 minRatio,
            uint256 liquidationThreshold,
            uint256 maxStaleness
        )
    {
        (minRatio, liquidationThreshold) = ZeroGConfig.getRecommendedRatios(
            loanAsset,
            collateralAsset
        );

        // Use the more conservative staleness requirement between the two assets
        uint256 loanStaleness = ZeroGConfig.getRecommendedStaleness(loanAsset);
        uint256 collateralStaleness = ZeroGConfig.getRecommendedStaleness(
            collateralAsset
        );
        maxStaleness = loanStaleness < collateralStaleness
            ? loanStaleness
            : collateralStaleness;
    }

    /**
     * @notice Check if both tokens in a loan pair are supported
     * @param loanAsset The token being borrowed
     * @param collateralAsset The token being used as collateral
     * @return supported True if both tokens have price feeds configured
     */
    function isLoanPairSupported(
        address loanAsset,
        address collateralAsset
    ) external view returns (bool supported) {
        return
            tokenPriceFeedIds[loanAsset] != bytes32(0) &&
            tokenPriceFeedIds[collateralAsset] != bytes32(0);
    }

    /**
     * @notice Get all supported tokens for lending
     * @return tokens Array of supported token addresses
     */
    function getSupportedTokens()
        external
        pure
        returns (address[] memory tokens)
    {
        (tokens, ) = ZeroGConfig.getSupportedTokens();
    }

    // ============ External Functions ============

    /**
     * @notice Creates a new loan offer with default oracle parameters
     * @param _tokenAddress Address of the ERC20 token to lend
     * @param _amount Amount of tokens to lend
     * @param _interestRate Interest rate in basis points (e.g., 500 = 5%)
     * @param _duration Loan duration in seconds
     * @param _collateralAddress Address of the collateral token
     * @param _collateralAmount Amount of collateral required
     */
    function createLoanOffer(
        address _tokenAddress,
        uint256 _amount,
        uint256 _interestRate,
        uint256 _duration,
        address _collateralAddress,
        uint256 _collateralAmount
    ) external nonReentrant {
        // Use recommended parameters from ZeroGConfig
        (
            uint256 minRatio,
            uint256 liquidationThreshold,
            uint256 maxStaleness
        ) = this.getRecommendedParameters(_tokenAddress, _collateralAddress);

        _createLoanOfferInternal(
            _tokenAddress,
            _amount,
            _interestRate,
            _duration,
            _collateralAddress,
            _collateralAmount,
            minRatio,
            liquidationThreshold,
            maxStaleness
        );
    }

    /**
     * @notice Creates a new loan offer with custom oracle parameters
     * @param _tokenAddress Address of the ERC20 token to lend
     * @param _amount Amount of tokens to lend
     * @param _interestRate Interest rate in basis points (e.g., 500 = 5%)
     * @param _duration Loan duration in seconds
     * @param _collateralAddress Address of the collateral token
     * @param _collateralAmount Amount of collateral required
     * @param _minCollateralRatioBPS Minimum acceptable collateral ratio for this loan (e.g., 15000 for 150%)
     * @param _liquidationThresholdBPS Collateral ratio below which loan can be liquidated (e.g., 12000 for 120%)
     * @param _maxPriceStaleness Max age of oracle price data for this loan (seconds)
     */
    function createLoanOffer(
        address _tokenAddress,
        uint256 _amount,
        uint256 _interestRate,
        uint256 _duration,
        address _collateralAddress,
        uint256 _collateralAmount,
        uint256 _minCollateralRatioBPS,
        uint256 _liquidationThresholdBPS,
        uint256 _maxPriceStaleness
    ) external nonReentrant {
        _createLoanOfferInternal(
            _tokenAddress,
            _amount,
            _interestRate,
            _duration,
            _collateralAddress,
            _collateralAmount,
            _minCollateralRatioBPS,
            _liquidationThresholdBPS,
            _maxPriceStaleness
        );
    }

    /**
     * @notice Internal function to create loan offers (shared logic)
     */
    function _createLoanOfferInternal(
        address _tokenAddress,
        uint256 _amount,
        uint256 _interestRate,
        uint256 _duration,
        address _collateralAddress,
        uint256 _collateralAmount,
        uint256 _minCollateralRatioBPS,
        uint256 _liquidationThresholdBPS,
        uint256 _maxPriceStaleness
    ) internal {
        // Input validation
        require(_tokenAddress != address(0), "Invalid token address");
        require(_amount > 0, "Amount must be greater than 0");
        require(_interestRate > 0, "Interest rate must be greater than 0");
        require(_interestRate <= 10000, "Interest rate cannot exceed 100%"); // Max 100% APR
        require(_duration > 0, "Duration must be greater than 0");
        require(_duration <= 365 days, "Duration cannot exceed 1 year");
        require(_collateralAddress != address(0), "Invalid collateral address");
        require(
            _collateralAmount > 0,
            "Collateral amount must be greater than 0"
        );

        // Collateralization parameters validation
        require(
            _minCollateralRatioBPS >= _liquidationThresholdBPS,
            "Min ratio must be >= liquidation threshold"
        );
        require(
            _liquidationThresholdBPS > 10000,
            "Liquidation threshold must be > 100%"
        ); // Ensure overcollateralized
        require(_maxPriceStaleness > 0, "Max price staleness must be set");

        // Check if Pyth price feeds are set for both tokens
        bool hasLoanPriceFeed = tokenPriceFeedIds[_tokenAddress] != bytes32(0);
        bool hasCollateralPriceFeed = tokenPriceFeedIds[_collateralAddress] !=
            bytes32(0);

        // For production loans, both price feeds should be set
        // For testing with unsupported tokens, we allow creation without price feeds
        if (hasLoanPriceFeed || hasCollateralPriceFeed) {
            require(hasLoanPriceFeed, "Price feed not set for loan token");
            require(
                hasCollateralPriceFeed,
                "Price feed not set for collateral token"
            );
        }

        // Get the current loan ID and increment for next use
        uint256 currentLoanId = nextLoanId;
        nextLoanId++;

        // Transfer loan amount from lender to contract (escrow)
        IERC20(_tokenAddress).safeTransferFrom(
            msg.sender,
            address(this),
            _amount
        );

        // Create new loan struct
        Loan memory newLoan = Loan({
            id: currentLoanId,
            lender: msg.sender,
            borrower: address(0), // No borrower yet
            tokenAddress: _tokenAddress,
            amount: _amount,
            interestRate: _interestRate,
            duration: _duration,
            collateralAddress: _collateralAddress,
            collateralAmount: _collateralAmount,
            startTime: 0, // Will be set when loan is accepted
            status: LoanStatus.Pending,
            minCollateralRatioBPS: _minCollateralRatioBPS,
            liquidationThresholdBPS: _liquidationThresholdBPS,
            maxPriceStaleness: _maxPriceStaleness,
            repaidAmount: 0 // Initialize repaid amount to 0
        });

        // Store the loan
        loans[currentLoanId] = newLoan;

        // Add to active loan offers
        activeLoanOfferIds.push(currentLoanId);

        // Track position in activeLoanOfferIds for O(1) removal
        activeLoanOfferIndex[currentLoanId] = activeLoanOfferIds.length - 1;

        // Update lender's loan mapping
        lenderLoans[msg.sender].push(currentLoanId);

        // Emit event
        emit LoanCreated(
            currentLoanId,
            msg.sender,
            _tokenAddress,
            _amount,
            _interestRate,
            _duration,
            _collateralAddress,
            _collateralAmount,
            _minCollateralRatioBPS,
            _liquidationThresholdBPS,
            _maxPriceStaleness
        );
    }

    /**
     * @notice Cancels a pending loan offer and returns funds to lender
     * @param loanId The ID of the loan offer to cancel
     */
    function cancelLoanOffer(uint256 loanId) external nonReentrant {
        // Verify loan exists and is in pending status
        Loan storage loan = loans[loanId];
        require(loan.status == LoanStatus.Pending, "Loan is not pending");
        require(msg.sender == loan.lender, "Only lender can cancel");

        // Return escrowed funds to lender
        IERC20(loan.tokenAddress).safeTransfer(loan.lender, loan.amount);

        // Update loan status
        loan.status = LoanStatus.Cancelled;

        // Remove from active loan offers
        _removeLoanFromActiveOffers(loanId);

        // Emit event
        emit LoanOfferCancelled(loanId, msg.sender, block.timestamp);
    }

    // ============ Pyth Oracle Helper Functions ============

    /**
     * @notice Get the latest price from Pyth with price update
     * @param _feedId The Pyth price feed ID
     * @param _maxStaleness Maximum acceptable age of the price in seconds
     * @param _priceUpdate Encoded price update data from Pyth Hermes
     * @return price The latest price scaled to 18 decimals
     * @return isStale Boolean indicating if price is stale
     */
    function _getLatestPriceWithUpdate(
        bytes32 _feedId,
        uint256 _maxStaleness,
        bytes[] calldata _priceUpdate
    ) internal returns (uint256 price, bool isStale) {
        // Update price feeds if update data is provided
        if (_priceUpdate.length > 0) {
            uint256 updateFee = pyth.getUpdateFee(_priceUpdate);
            require(
                msg.value >= updateFee,
                "Insufficient fee for price update"
            );
            pyth.updatePriceFeeds{value: updateFee}(_priceUpdate);
        }

        // Get the current price
        PythStructs.Price memory pythPrice = pyth.getPriceNoOlderThan(
            _feedId,
            _maxStaleness
        );

        // Check if price is stale (this should not happen if getPriceNoOlderThan succeeds)
        isStale = false;

        // Convert price to 18 decimals
        // Pyth prices have a configurable exponent, typically negative
        int32 expo = pythPrice.expo;
        int64 priceValue = pythPrice.price;

        require(priceValue > 0, "Invalid price from Pyth oracle");

        if (expo >= 0) {
            // Positive exponent: multiply by 10^expo then scale to 18 decimals
            price =
                uint256(uint64(priceValue)) *
                (10 ** uint256(int256(expo))) *
                (10 ** 18);
        } else {
            // Negative exponent: divide by 10^(-expo) then scale to 18 decimals
            uint256 divisor = 10 ** uint256(int256(-expo));
            price = (uint256(uint64(priceValue)) * (10 ** 18)) / divisor;
        }
    }

    /**
     * @notice Get the latest price from Pyth without update (view function)
     * @param _feedId The Pyth price feed ID
     * @param _maxStaleness Maximum acceptable age of the price in seconds
     * @return price The latest price scaled to 18 decimals
     * @return isStale Boolean indicating if price is stale
     */
    function _getLatestPrice(
        bytes32 _feedId,
        uint256 _maxStaleness
    ) internal view returns (uint256 price, bool isStale) {
        try pyth.getPriceNoOlderThan(_feedId, _maxStaleness) returns (
            PythStructs.Price memory pythPrice
        ) {
            isStale = false;

            // Convert price to 18 decimals
            int32 expo = pythPrice.expo;
            int64 priceValue = pythPrice.price;

            require(priceValue > 0, "Invalid price from Pyth oracle");

            if (expo >= 0) {
                price =
                    uint256(uint64(priceValue)) *
                    (10 ** uint256(int256(expo))) *
                    (10 ** 18);
            } else {
                uint256 divisor = 10 ** uint256(int256(-expo));
                price = (uint256(uint64(priceValue)) * (10 ** 18)) / divisor;
            }
        } catch {
            // Price is too stale or feed doesn't exist
            isStale = true;
            price = 0;
        }
    }

    /**
     * @notice Calculates the current collateralization ratio for a given loan
     * @param loanId The ID of the loan
     * @return currentCollateralRatio The ratio in basis points (e.g., 15000 for 150%)
     * @return priceStale True if any required oracle price is stale
     */
    function _getCollateralizationRatio(
        uint256 loanId
    ) internal view returns (uint256 currentCollateralRatio, bool priceStale) {
        Loan storage loan = loans[loanId];

        // Get Pyth feed IDs
        bytes32 collateralFeedId = tokenPriceFeedIds[loan.collateralAddress];
        bytes32 loanTokenFeedId = tokenPriceFeedIds[loan.tokenAddress];

        // Get prices for collateral and loan tokens
        (uint256 collateralPrice, bool collateralStale) = _getLatestPrice(
            collateralFeedId,
            loan.maxPriceStaleness
        );
        (uint256 loanTokenPrice, bool tokenStale) = _getLatestPrice(
            loanTokenFeedId,
            loan.maxPriceStaleness
        );

        // If either price is stale, mark as priceStale
        priceStale = collateralStale || tokenStale;

        // Get token decimals and scale amounts to 18 decimals for consistent calculations
        uint8 collateralDecimals = IERC20Metadata(loan.collateralAddress)
            .decimals();
        uint8 loanTokenDecimals = IERC20Metadata(loan.tokenAddress).decimals();

        // Scale collateral amount to 18 decimals
        uint256 scaledCollateralAmount;
        if (collateralDecimals < 18) {
            scaledCollateralAmount =
                loan.collateralAmount *
                (10 ** (18 - collateralDecimals));
        } else if (collateralDecimals > 18) {
            scaledCollateralAmount =
                loan.collateralAmount /
                (10 ** (collateralDecimals - 18));
        } else {
            scaledCollateralAmount = loan.collateralAmount;
        }

        // Scale loan amount to 18 decimals
        uint256 scaledLoanAmount;
        if (loanTokenDecimals < 18) {
            scaledLoanAmount = loan.amount * (10 ** (18 - loanTokenDecimals));
        } else if (loanTokenDecimals > 18) {
            scaledLoanAmount = loan.amount / (10 ** (loanTokenDecimals - 18));
        } else {
            scaledLoanAmount = loan.amount;
        }

        // Calculate value of collateral and loan in USD (18 decimals)
        uint256 collateralValue = (scaledCollateralAmount * collateralPrice) /
            (10 ** 18);
        uint256 loanValue = (scaledLoanAmount * loanTokenPrice) / (10 ** 18);

        // Avoid division by zero
        if (loanValue == 0) {
            return (type(uint256).max, priceStale); // Effectively infinite ratio
        }

        // Calculate ratio: (Collateral Value / Loan Value) * 10000 (for basis points)
        currentCollateralRatio = (collateralValue * 10000) / loanValue;
    }

    /**
     * @notice Accepts an existing loan offer with price update
     * @param loanId The ID of the loan offer to accept
     * @param priceUpdate Encoded price update data from Pyth Hermes
     */
    function acceptLoanOffer(
        uint256 loanId,
        bytes[] calldata priceUpdate
    ) external payable nonReentrant {
        // Verify loan exists and is in pending status
        Loan storage loan = loans[loanId];
        require(loan.id != 0, "Loan does not exist");
        require(loan.status == LoanStatus.Pending, "Loan is not pending");
        require(msg.sender != loan.lender, "Lender cannot accept own loan");

        // Check if Pyth price feeds are available for collateral ratio calculation
        bool hasLoanPriceFeed = tokenPriceFeedIds[loan.tokenAddress] !=
            bytes32(0);
        bool hasCollateralPriceFeed = tokenPriceFeedIds[
            loan.collateralAddress
        ] != bytes32(0);

        // Initialize updateFee
        uint256 updateFee = 0;

        // Only validate collateral ratio if both price feeds are available
        if (
            hasLoanPriceFeed && hasCollateralPriceFeed && priceUpdate.length > 0
        ) {
            // Update prices and validate collateral ratio
            bytes32 collateralFeedId = tokenPriceFeedIds[
                loan.collateralAddress
            ];
            bytes32 loanTokenFeedId = tokenPriceFeedIds[loan.tokenAddress];

            // Create feed ID array for the update
            bytes32[] memory feedIds = new bytes32[](2);
            feedIds[0] = collateralFeedId;
            feedIds[1] = loanTokenFeedId;

            // Update prices
            updateFee = pyth.getUpdateFee(priceUpdate);
            require(
                msg.value >= updateFee,
                "Insufficient fee for price update"
            );
            pyth.updatePriceFeeds{value: updateFee}(priceUpdate);

            emit PriceUpdatePaid(loanId, updateFee, block.timestamp);

            // Validate collateral ratio with fresh prices
            (
                uint256 currentRatio,
                bool priceStale
            ) = _getCollateralizationRatio(loanId);
            require(!priceStale, "Oracle prices are too stale to accept loan");
            require(
                currentRatio >= loan.minCollateralRatioBPS,
                "Insufficient collateral based on current prices"
            );
        }

        // Transfer collateral from borrower to contract
        IERC20(loan.collateralAddress).safeTransferFrom(
            msg.sender,
            address(this),
            loan.collateralAmount
        );

        // Transfer loan amount from contract to borrower
        IERC20(loan.tokenAddress).safeTransfer(msg.sender, loan.amount);

        // Update loan details
        loan.borrower = msg.sender;
        loan.startTime = block.timestamp;
        loan.status = LoanStatus.Active;

        // Remove from active loan offers array
        _removeLoanFromActiveOffers(loanId);

        // Add to borrower's loan mapping
        borrowerLoans[msg.sender].push(loanId);

        // Emit event with collateral ratio (0 if price feeds not available)
        uint256 eventCollateralRatio = 0;
        if (hasLoanPriceFeed && hasCollateralPriceFeed) {
            (eventCollateralRatio, ) = _getCollateralizationRatio(loanId);
        }
        emit LoanAccepted(
            loanId,
            msg.sender,
            block.timestamp,
            eventCollateralRatio
        );

        // Refund excess ETH
        if (msg.value > updateFee) {
            payable(msg.sender).transfer(msg.value - updateFee);
        }
    }

    /**
     * @notice Accepts an existing loan offer without price update (for testing)
     * @param loanId The ID of the loan offer to accept
     */
    function acceptLoanOffer(uint256 loanId) external nonReentrant {
        bytes[] memory emptyUpdate = new bytes[](0);
        this.acceptLoanOffer{value: 0}(loanId, emptyUpdate);
    }

    /**
     * @notice Repays an active loan
     * @param loanId The ID of the loan to repay
     */
    function repayLoan(uint256 loanId) external nonReentrant {
        // Verify loan exists and is active
        Loan storage loan = loans[loanId];
        require(loan.id != 0, "Loan does not exist");
        require(loan.status == LoanStatus.Active, "Loan is not active");
        require(msg.sender == loan.borrower, "Only borrower can repay");

        // Calculate interest based on time elapsed with improved precision
        uint256 timeElapsed = block.timestamp - loan.startTime;

        // Use 365.25 days for more accurate year calculation (accounting for leap years)
        uint256 annualizedAmount = (loan.amount * loan.interestRate) / 10000;
        uint256 interest = (annualizedAmount * timeElapsed) / 31557600; // 365.25 * 24 * 60 * 60 = 31557600 seconds per year

        uint256 totalRepayment = loan.amount + interest;

        // Transfer repayment from borrower to lender
        IERC20(loan.tokenAddress).safeTransferFrom(
            msg.sender,
            loan.lender,
            totalRepayment
        );

        // Return collateral to borrower
        IERC20(loan.collateralAddress).safeTransfer(
            msg.sender,
            loan.collateralAmount
        );

        // Update loan status
        loan.status = LoanStatus.Repaid;

        // Emit event
        emit LoanRepaid(loanId, msg.sender, totalRepayment, block.timestamp);
    }

    /**
     * @notice Allows borrower to add additional collateral to an active loan
     * @param loanId The ID of the loan to add collateral to
     * @param additionalAmount Amount of additional collateral to add
     */
    function addCollateral(
        uint256 loanId,
        uint256 additionalAmount
    ) external nonReentrant {
        // Verify loan exists and is active
        Loan storage loan = loans[loanId];
        require(loan.id != 0, "Loan does not exist");
        require(loan.status == LoanStatus.Active, "Loan is not active");
        require(
            msg.sender == loan.borrower,
            "Only borrower can add collateral"
        );
        require(
            additionalAmount > 0,
            "Additional amount must be greater than 0"
        );

        // Transfer additional collateral from borrower to contract
        IERC20(loan.collateralAddress).safeTransferFrom(
            msg.sender,
            address(this),
            additionalAmount
        );

        // Update loan collateral amount
        loan.collateralAmount += additionalAmount;

        // Calculate new collateral ratio (if price feeds available)
        uint256 newCollateralRatio = 0;
        bool hasLoanPriceFeed = tokenPriceFeedIds[loan.tokenAddress] !=
            bytes32(0);
        bool hasCollateralPriceFeed = tokenPriceFeedIds[
            loan.collateralAddress
        ] != bytes32(0);

        if (hasLoanPriceFeed && hasCollateralPriceFeed) {
            (newCollateralRatio, ) = _getCollateralizationRatio(loanId);
        }

        // Emit event
        emit CollateralAdded(
            loanId,
            msg.sender,
            additionalAmount,
            newCollateralRatio,
            block.timestamp
        );
    }

    /**
     * @notice Allows borrower to remove collateral from an active loan (if health factor allows)
     * @param loanId The ID of the loan to remove collateral from
     * @param removeAmount Amount of collateral to remove
     * @param priceUpdate Encoded price update data from Pyth Hermes
     */
    function removeCollateral(
        uint256 loanId,
        uint256 removeAmount,
        bytes[] calldata priceUpdate
    ) external payable nonReentrant {
        // Verify loan exists and is active
        Loan storage loan = loans[loanId];
        require(loan.id != 0, "Loan does not exist");
        require(loan.status == LoanStatus.Active, "Loan is not active");
        require(
            msg.sender == loan.borrower,
            "Only borrower can remove collateral"
        );
        require(removeAmount > 0, "Remove amount must be greater than 0");
        require(
            removeAmount <= loan.collateralAmount,
            "Cannot remove more than available collateral"
        );

        // Check if Pyth price feeds are available for collateral ratio calculation
        bool hasLoanPriceFeed = tokenPriceFeedIds[loan.tokenAddress] !=
            bytes32(0);
        bool hasCollateralPriceFeed = tokenPriceFeedIds[
            loan.collateralAddress
        ] != bytes32(0);

        uint256 updateFee = 0;

        // If price feeds are available, ensure removal won't violate minimum collateral ratio
        if (hasLoanPriceFeed && hasCollateralPriceFeed) {
            // Update prices if update data provided
            if (priceUpdate.length > 0) {
                updateFee = pyth.getUpdateFee(priceUpdate);
                require(
                    msg.value >= updateFee,
                    "Insufficient fee for price update"
                );
                pyth.updatePriceFeeds{value: updateFee}(priceUpdate);
            }

            // Temporarily reduce collateral to check new ratio
            uint256 originalCollateral = loan.collateralAmount;
            loan.collateralAmount -= removeAmount;

            (uint256 newRatio, bool priceStale) = _getCollateralizationRatio(
                loanId
            );

            // Restore original collateral amount
            loan.collateralAmount = originalCollateral;

            require(!priceStale, "Oracle prices are too stale");
            require(
                newRatio >= loan.minCollateralRatioBPS,
                "Removal would violate minimum collateral ratio"
            );
        }

        // Update loan collateral amount
        loan.collateralAmount -= removeAmount;

        // Transfer collateral back to borrower
        IERC20(loan.collateralAddress).safeTransfer(msg.sender, removeAmount);

        // Calculate new collateral ratio for event
        uint256 newCollateralRatio = 0;
        if (hasLoanPriceFeed && hasCollateralPriceFeed) {
            (newCollateralRatio, ) = _getCollateralizationRatio(loanId);
        }

        // Emit event
        emit CollateralRemoved(
            loanId,
            msg.sender,
            removeAmount,
            newCollateralRatio,
            block.timestamp
        );

        // Refund excess ETH
        if (msg.value > updateFee) {
            payable(msg.sender).transfer(msg.value - updateFee);
        }
    }

    /**
     * @notice Allows borrower to make a partial repayment on an active loan
     * @param loanId The ID of the loan to make partial repayment on
     * @param repaymentAmount Amount to repay (principal + interest portion)
     */
    function makePartialRepayment(
        uint256 loanId,
        uint256 repaymentAmount
    ) external nonReentrant {
        // Verify loan exists and is active
        Loan storage loan = loans[loanId];
        require(loan.id != 0, "Loan does not exist");
        require(loan.status == LoanStatus.Active, "Loan is not active");
        require(
            msg.sender == loan.borrower,
            "Only borrower can make repayment"
        );
        require(repaymentAmount > 0, "Repayment amount must be greater than 0");

        // Calculate current total owed (principal + interest)
        uint256 timeElapsed = block.timestamp - loan.startTime;
        uint256 annualizedAmount = (loan.amount * loan.interestRate) / 10000;
        uint256 totalInterest = (annualizedAmount * timeElapsed) / 31557600;
        uint256 totalOwed = loan.amount + totalInterest;
        uint256 remainingOwed = totalOwed - loan.repaidAmount;

        require(
            repaymentAmount <= remainingOwed,
            "Repayment amount exceeds remaining debt"
        );

        // Transfer repayment from borrower to lender
        IERC20(loan.tokenAddress).safeTransferFrom(
            msg.sender,
            loan.lender,
            repaymentAmount
        );

        // Update repaid amount
        loan.repaidAmount += repaymentAmount;
        uint256 newRemainingAmount = remainingOwed - repaymentAmount;

        // If fully repaid, return collateral and mark as repaid
        if (newRemainingAmount == 0) {
            // Return collateral to borrower
            IERC20(loan.collateralAddress).safeTransfer(
                msg.sender,
                loan.collateralAmount
            );

            // Update loan status
            loan.status = LoanStatus.Repaid;

            // Emit full repayment event
            emit LoanRepaid(
                loanId,
                msg.sender,
                loan.repaidAmount,
                block.timestamp
            );
        }

        // Emit partial repayment event
        emit PartialRepayment(
            loanId,
            msg.sender,
            repaymentAmount,
            loan.repaidAmount,
            newRemainingAmount,
            block.timestamp
        );
    }

    /**
     * @notice Liquidates a defaulted loan with price update
     * @param loanId The ID of the loan to liquidate
     * @param priceUpdate Encoded price update data from Pyth Hermes
     */
    function liquidateLoan(
        uint256 loanId,
        bytes[] calldata priceUpdate
    ) external payable nonReentrant {
        // Verify loan exists and is active
        Loan storage loan = loans[loanId];
        require(loan.id != 0, "Loan does not exist");
        require(loan.status == LoanStatus.Active, "Loan is not active");

        // Check for default conditions
        bool timeDefaulted = block.timestamp > loan.startTime + loan.duration;
        bool priceDefaulted = false;

        // Check for price-based default only if price feeds are available
        bool hasLoanPriceFeed = tokenPriceFeedIds[loan.tokenAddress] !=
            bytes32(0);
        bool hasCollateralPriceFeed = tokenPriceFeedIds[
            loan.collateralAddress
        ] != bytes32(0);

        uint256 updateFee = 0;

        if (hasLoanPriceFeed && hasCollateralPriceFeed) {
            // Update prices if update data provided
            if (priceUpdate.length > 0) {
                updateFee = pyth.getUpdateFee(priceUpdate);
                require(
                    msg.value >= updateFee,
                    "Insufficient fee for price update"
                );
                pyth.updatePriceFeeds{value: updateFee}(priceUpdate);
            }

            (
                uint256 currentRatio,
                bool priceStale
            ) = _getCollateralizationRatio(loanId);
            require(!priceStale, "Oracle prices are too stale to liquidate");
            priceDefaulted = currentRatio < loan.liquidationThresholdBPS;
        }

        require(
            timeDefaulted || priceDefaulted,
            "Loan has not defaulted yet (time or price)"
        );

        // Calculate liquidator fee and remaining collateral for lender
        uint256 liquidatorFee = (loan.collateralAmount * LIQUIDATION_FEE_BPS) /
            10000;
        uint256 collateralToLender = loan.collateralAmount - liquidatorFee;

        // Transfer liquidator fee to the caller (incentive for liquidation)
        if (liquidatorFee > 0) {
            IERC20(loan.collateralAddress).safeTransfer(
                msg.sender,
                liquidatorFee
            );
        }

        // Transfer remaining collateral to lender
        IERC20(loan.collateralAddress).safeTransfer(
            loan.lender,
            collateralToLender
        );

        // Update loan status
        loan.status = LoanStatus.Defaulted;

        // Emit event
        emit LoanLiquidated(
            loanId,
            msg.sender,
            collateralToLender,
            liquidatorFee,
            block.timestamp
        );

        // Refund excess ETH
        if (msg.value > updateFee) {
            payable(msg.sender).transfer(msg.value - updateFee);
        }
    }

    // ============ View Functions ============

    /**
     * @notice Returns all active loan offer IDs
     * @return Array of active loan offer IDs
     */
    function getActiveLoanOffers() external view returns (uint256[] memory) {
        return activeLoanOfferIds;
    }

    /**
     * @notice Returns paginated active loan offer IDs
     * @param startIndex Starting index for pagination
     * @param count Maximum number of offers to return
     * @return Array of active loan offer IDs (up to count items)
     */
    function getActiveLoanOffersPaginated(
        uint256 startIndex,
        uint256 count
    ) external view returns (uint256[] memory) {
        uint256 totalOffers = activeLoanOfferIds.length;

        if (startIndex >= totalOffers) {
            return new uint256[](0);
        }

        uint256 endIndex = startIndex + count;
        if (endIndex > totalOffers) {
            endIndex = totalOffers;
        }

        uint256 resultLength = endIndex - startIndex;
        uint256[] memory result = new uint256[](resultLength);

        for (uint256 i = 0; i < resultLength; i++) {
            result[i] = activeLoanOfferIds[startIndex + i];
        }

        return result;
    }

    /**
     * @notice Returns the total count of active loan offers
     * @return Total number of active loan offers
     */
    function getActiveLoanOffersCount() external view returns (uint256) {
        return activeLoanOfferIds.length;
    }

    /**
     * @notice Gets loan details by ID
     * @param loanId The loan ID to query
     * @return Loan struct containing all loan details
     */
    function getLoan(uint256 loanId) external view returns (Loan memory) {
        return loans[loanId];
    }

    /**
     * @notice Gets all loan IDs for a lender
     * @param lender The lender's address
     * @return Array of loan IDs where the address is the lender
     */
    function getLenderLoans(
        address lender
    ) external view returns (uint256[] memory) {
        return lenderLoans[lender];
    }

    /**
     * @notice Gets paginated loan IDs for a lender
     * @param lender The lender's address
     * @param startIndex Starting index for pagination
     * @param count Maximum number of loans to return
     * @return Array of loan IDs (up to count items)
     */
    function getLenderLoansPaginated(
        address lender,
        uint256 startIndex,
        uint256 count
    ) external view returns (uint256[] memory) {
        uint256[] storage allLoans = lenderLoans[lender];
        uint256 totalLoans = allLoans.length;

        if (startIndex >= totalLoans) {
            return new uint256[](0);
        }

        uint256 endIndex = startIndex + count;
        if (endIndex > totalLoans) {
            endIndex = totalLoans;
        }

        uint256 resultLength = endIndex - startIndex;
        uint256[] memory result = new uint256[](resultLength);

        for (uint256 i = 0; i < resultLength; i++) {
            result[i] = allLoans[startIndex + i];
        }

        return result;
    }

    /**
     * @notice Gets all loan IDs for a borrower
     * @param borrower The borrower's address
     * @return Array of loan IDs where the address is the borrower
     */
    function getBorrowerLoans(
        address borrower
    ) external view returns (uint256[] memory) {
        return borrowerLoans[borrower];
    }

    /**
     * @notice Gets paginated loan IDs for a borrower
     * @param borrower The borrower's address
     * @param startIndex Starting index for pagination
     * @param count Maximum number of loans to return
     * @return Array of loan IDs (up to count items)
     */
    function getBorrowerLoansPaginated(
        address borrower,
        uint256 startIndex,
        uint256 count
    ) external view returns (uint256[] memory) {
        uint256[] storage allLoans = borrowerLoans[borrower];
        uint256 totalLoans = allLoans.length;

        if (startIndex >= totalLoans) {
            return new uint256[](0);
        }

        uint256 endIndex = startIndex + count;
        if (endIndex > totalLoans) {
            endIndex = totalLoans;
        }

        uint256 resultLength = endIndex - startIndex;
        uint256[] memory result = new uint256[](resultLength);

        for (uint256 i = 0; i < resultLength; i++) {
            result[i] = allLoans[startIndex + i];
        }

        return result;
    }

    /**
     * @notice Returns the total count of loans for a lender
     * @param lender The lender's address
     * @return Total number of loans for the lender
     */
    function getLenderLoansCount(
        address lender
    ) external view returns (uint256) {
        return lenderLoans[lender].length;
    }

    /**
     * @notice Returns the total count of loans for a borrower
     * @param borrower The borrower's address
     * @return Total number of loans for the borrower
     */
    function getBorrowerLoansCount(
        address borrower
    ) external view returns (uint256) {
        return borrowerLoans[borrower].length;
    }

    /**
     * @notice Checks if a loan exists
     * @param loanId The loan ID to check
     * @return True if the loan exists, false otherwise
     */
    function loanExists(uint256 loanId) external view returns (bool) {
        return loans[loanId].id != 0;
    }

    /**
     * @notice Calculates the current interest for an active loan
     * @param loanId The loan ID to calculate interest for
     * @return The current interest amount
     */
    function calculateCurrentInterest(
        uint256 loanId
    ) external view returns (uint256) {
        Loan storage loan = loans[loanId];
        require(loan.id != 0, "Loan does not exist");
        require(loan.status == LoanStatus.Active, "Loan is not active");

        uint256 timeElapsed = block.timestamp - loan.startTime;
        uint256 annualizedAmount = (loan.amount * loan.interestRate) / 10000;
        return (annualizedAmount * timeElapsed) / 31557600;
    }

    /**
     * @notice Calculates the total repayment amount for an active loan
     * @param loanId The loan ID to calculate repayment for
     * @return The total repayment amount (principal + interest)
     */
    function calculateTotalRepayment(
        uint256 loanId
    ) external view returns (uint256) {
        uint256 interest = this.calculateCurrentInterest(loanId);
        return loans[loanId].amount + interest;
    }

    /**
     * @notice Checks if a loan has defaulted (past due date or undercollateralized)
     * @param loanId The loan ID to check
     * @return True if the loan has defaulted, false otherwise
     */
    function isLoanDefaulted(uint256 loanId) external view returns (bool) {
        Loan storage loan = loans[loanId];
        require(loan.id != 0, "Loan does not exist");

        if (loan.status != LoanStatus.Active) {
            return false;
        }

        bool timeDefaulted = block.timestamp > loan.startTime + loan.duration;
        bool priceDefaulted = false;

        // Check for price-based default only if price feeds are available
        bool hasLoanPriceFeed = tokenPriceFeedIds[loan.tokenAddress] !=
            bytes32(0);
        bool hasCollateralPriceFeed = tokenPriceFeedIds[
            loan.collateralAddress
        ] != bytes32(0);

        if (hasLoanPriceFeed && hasCollateralPriceFeed) {
            (
                uint256 currentRatio,
                bool priceStale
            ) = _getCollateralizationRatio(loanId);
            if (!priceStale) {
                priceDefaulted = currentRatio < loan.liquidationThresholdBPS;
            }
        }

        return timeDefaulted || priceDefaulted;
    }

    /**
     * @notice Gets detailed repayment information for an active loan
     * @param loanId The loan ID to query
     * @return totalOwed Total amount owed (principal + interest)
     * @return repaidAmount Amount already repaid
     * @return remainingAmount Amount still owed
     * @return interestAccrued Total interest accrued so far
     */
    function getLoanRepaymentInfo(
        uint256 loanId
    )
        external
        view
        returns (
            uint256 totalOwed,
            uint256 repaidAmount,
            uint256 remainingAmount,
            uint256 interestAccrued
        )
    {
        Loan storage loan = loans[loanId];
        require(loan.id != 0, "Loan does not exist");
        require(loan.status == LoanStatus.Active, "Loan is not active");

        uint256 timeElapsed = block.timestamp - loan.startTime;
        uint256 annualizedAmount = (loan.amount * loan.interestRate) / 10000;
        interestAccrued = (annualizedAmount * timeElapsed) / 31557600;
        totalOwed = loan.amount + interestAccrued;
        repaidAmount = loan.repaidAmount;
        remainingAmount = totalOwed - repaidAmount;
    }

    /**
     * @notice Gets the current health factor (collateralization ratio) of an active loan
     * @param loanId The ID of the loan
     * @return currentRatio The current collateralization ratio in basis points
     * @return priceStale True if any required oracle price is stale
     */
    function getLoanHealthFactor(
        uint256 loanId
    ) external view returns (uint256 currentRatio, bool priceStale) {
        Loan storage loan = loans[loanId];
        require(loan.id != 0, "Loan does not exist");
        require(loan.status == LoanStatus.Active, "Loan is not active");

        return _getCollateralizationRatio(loanId);
    }

    /**
     * @notice Get the fee required to update price feeds
     * @param priceUpdate Encoded price update data from Pyth Hermes
     * @return updateFee The fee required in wei
     */
    function getUpdateFee(
        bytes[] calldata priceUpdate
    ) external view returns (uint256 updateFee) {
        return pyth.getUpdateFee(priceUpdate);
    }

    /**
     * @notice Get current price for a token without updating
     * @param tokenAddress The token address
     * @param maxStaleness Maximum acceptable age in seconds
     * @return price Current price in USD (18 decimals)
     * @return isStale Whether the price is stale
     */
    function getCurrentPrice(
        address tokenAddress,
        uint256 maxStaleness
    ) external view returns (uint256 price, bool isStale) {
        bytes32 feedId = tokenPriceFeedIds[tokenAddress];
        require(feedId != bytes32(0), "Price feed not set for token");

        return _getLatestPrice(feedId, maxStaleness);
    }

    // ============ Internal Functions ============

    /**
     * @notice Removes a loan ID from the activeLoanOfferIds array in O(1) time
     * @param loanId The loan ID to remove
     */
    function _removeLoanFromActiveOffers(uint256 loanId) internal {
        uint256 length = activeLoanOfferIds.length;
        if (length == 0) return;

        // Get the index of the loan ID to remove
        uint256 indexToRemove = activeLoanOfferIndex[loanId];

        // Ensure the loan ID is actually in the array
        if (
            indexToRemove < length &&
            activeLoanOfferIds[indexToRemove] == loanId
        ) {
            // If not the last element, swap with last element
            if (indexToRemove != length - 1) {
                uint256 lastLoanId = activeLoanOfferIds[length - 1];
                activeLoanOfferIds[indexToRemove] = lastLoanId;
                // Update the index mapping for the moved element
                activeLoanOfferIndex[lastLoanId] = indexToRemove;
            }

            // Remove the last element
            activeLoanOfferIds.pop();

            // Clean up the mapping
            delete activeLoanOfferIndex[loanId];

            // Emit event
            emit LoanOfferRemoved(loanId, "Loan accepted or cancelled");
        }
    }

    // ============ Receive Function ============

    /**
     * @notice Allow contract to receive ETH for price update fees
     */
    receive() external payable {}
}
