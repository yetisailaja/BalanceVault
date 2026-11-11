
-- Add new user roles.
-- Keep CUSTOMER temporarily for backward compatibility.
-- Existing users and financial records are preserved.

ALTER TYPE "UserRole" ADD VALUE 'ACCOUNT_HOLDER';

ALTER TYPE "UserRole" ADD VALUE 'AUDITOR';
