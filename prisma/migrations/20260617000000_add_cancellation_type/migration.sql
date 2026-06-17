-- Add CANCELLATION value to ReturnType enum
ALTER TYPE "ReturnType" ADD VALUE 'CANCELLATION';

-- Add cancellationEligible field to Return table
ALTER TABLE "Return" ADD COLUMN "cancellationEligible" BOOLEAN;
