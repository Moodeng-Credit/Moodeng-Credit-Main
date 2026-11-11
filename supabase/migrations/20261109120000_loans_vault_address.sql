-- BitRepo originator vault: loans drawn from the vault (admin Fund → "BitRepo Vault") record the vault's address,
-- so Admin → Credit line can list them and pay the vault back once the borrower repays. The vault keys each
-- loan by loans.id. NULL = not a vault loan.
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS vault_address text;

COMMENT ON COLUMN public.loans.vault_address IS
  'BitRepo originator vault (Base) the loan was drawn from, keyed on-chain by loans.id. NULL = not a vault loan.';

CREATE INDEX IF NOT EXISTS loans_vault_address_idx ON public.loans (vault_address) WHERE vault_address IS NOT NULL;
