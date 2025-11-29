CREATE TYPE "WorldIdStatus" AS ENUM ('INACTIVE', 'ACTIVE');

CREATE TYPE "LoanStatus" AS ENUM ('Requested', 'Lent');

CREATE TYPE "RepaymentStatus" AS ENUM ('Unpaid', 'Partial', 'Paid');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT,
    "username" TEXT NOT NULL,
    "isWorldId" "WorldIdStatus" NOT NULL,
    "nullifierHash" TEXT,
    "password" TEXT,
    "email" TEXT NOT NULL,
    "googleId" TEXT,
    "telegramId" BIGINT,
    "telegramUsername" TEXT,
    "chatId" BIGINT,
    "mal" INTEGER NOT NULL DEFAULT 3,
    "nal" INTEGER NOT NULL DEFAULT 0,
    "cs" INTEGER NOT NULL DEFAULT 15,
    "resetToken" TEXT,
    "resetTokenExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "trackingId" TEXT NOT NULL,
    "borrowerWallet" TEXT,
    "lenderWallet" TEXT,
    "borrowerUser" TEXT,
    "lenderUser" TEXT,
    "loanAmount" DECIMAL(18,6) NOT NULL,
    "repaidAmount" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "totalRepaymentAmount" DECIMAL(18,6) NOT NULL,
    "reason" TEXT NOT NULL,
    "loanStatus" "LoanStatus" NOT NULL,
    "repaymentStatus" "RepaymentStatus" NOT NULL,
    "days" INTEGER NOT NULL,
    "block" TEXT NOT NULL,
    "coin" TEXT NOT NULL,
    "hash" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);


CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");


CREATE UNIQUE INDEX "User_username_key" ON "User"("username");


CREATE UNIQUE INDEX "User_nullifierHash_key" ON "User"("nullifierHash");


CREATE UNIQUE INDEX "User_email_key" ON "User"("email");


CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");


CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");


CREATE UNIQUE INDEX "User_telegramUsername_key" ON "User"("telegramUsername");


CREATE UNIQUE INDEX "User_chatId_key" ON "User"("chatId");


CREATE UNIQUE INDEX "User_resetToken_key" ON "User"("resetToken");


CREATE UNIQUE INDEX "Loan_trackingId_key" ON "Loan"("trackingId");


CREATE INDEX "Loan_borrowerUser_idx" ON "Loan"("borrowerUser");


CREATE INDEX "Loan_lenderUser_idx" ON "Loan"("lenderUser");


CREATE INDEX "Loan_borrowerWallet_idx" ON "Loan"("borrowerWallet");


CREATE INDEX "Loan_lenderWallet_idx" ON "Loan"("lenderWallet");


CREATE INDEX "Loan_loanStatus_idx" ON "Loan"("loanStatus");


CREATE INDEX "Loan_repaymentStatus_idx" ON "Loan"("repaymentStatus");


CREATE INDEX "Loan_createdAt_idx" ON "Loan"("createdAt");


CREATE INDEX "Loan_lenderWallet_loanStatus_idx" ON "Loan"("lenderWallet", "loanStatus");


CREATE INDEX "Loan_createdAt_loanStatus_idx" ON "Loan"("createdAt", "loanStatus");
