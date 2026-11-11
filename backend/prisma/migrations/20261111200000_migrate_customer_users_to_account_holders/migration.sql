-- Convert existing customer users to the new account-holder role.
UPDATE "User"
SET "role" = 'ACCOUNT_HOLDER'
WHERE "role" = 'CUSTOMER';

-- Set the default role for newly created users.
ALTER TABLE "User"
ALTER COLUMN "role" SET DEFAULT 'ACCOUNT_HOLDER';