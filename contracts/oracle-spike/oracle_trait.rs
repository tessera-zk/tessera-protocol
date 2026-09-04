// oracle_trait.rs -- PROPOSED Reflector integration trait (issue #10, off-build stub).
// Not compiled by the workspace. Mirrors soroban-sdk style; decimals explicit.
//
// Design rules (enforced in any future implementation):
//   1. Prices come ONLY from the configured Reflector contract (no issuer input).
//   2. Every price has a timestamp; stale (> MAX_STALENESS ledgers) => reject.
//   3. Missing price => reject (never default to 1:1 or 0).
//   4. Fixed-point math with explicit overflow error (never saturate).
//   5. Base unit fixed at config time (e.g. USDC); legs declare their asset code.

pub const ORACLE_MAX_STALENESS_LEDGERS: u32 = 100;
pub const PRICE_DENOMINATOR: i128 = 10_000_000; // Reflector-style 7dp fixed point

#[derive(Clone, Debug)]
pub struct PricedLeg {
    pub holder: [u8; 56], // address str placeholder (stub uses bytes, real code uses Address)
    pub token: [u8; 56],
    pub asset_code: [u8; 12],
}

#[derive(Clone, Debug)]
pub struct PricedQuote {
    pub price_num: i128,   // price * PRICE_DENOMINATOR, in base units per leg unit
    pub price_ledger: u32, // ledger at which Reflector published it
}

pub trait ReflectorOracle {
    type Error;
    fn quote(&self, asset_code: &[u8]) -> Result<PricedQuote, Self::Error>;
}

pub fn scale_balance(balance: i128, quote: &PricedQuote, current_ledger: u32) -> Result<i128, &'static str> {
    if current_ledger.saturating_sub(quote.price_ledger) > ORACLE_MAX_STALENESS_LEDGERS {
        return Err("STALE_PRICE");
    }
    if quote.price_num <= 0 {
        return Err("BAD_PRICE");
    }
    balance.checked_mul(quote.price_num).ok_or("OVERFLOW")?.checked_div(PRICE_DENOMINATOR).ok_or("DIV_ZERO")
}

#[cfg(test)]
mod stub_tests {
    use super::*;
    #[test]
    fn spot_scales() {
        let q = PricedQuote { price_num: 2 * PRICE_DENOMINATOR, price_ledger: 100 };
        assert_eq!(scale_balance(50000, &q, 150).unwrap(), 100000);
    }
    #[test]
    fn stale_rejects() {
        let q = PricedQuote { price_num: PRICE_DENOMINATOR, price_ledger: 100 };
        assert_eq!(scale_balance(1, &q, 1000).unwrap_err(), "STALE_PRICE");
    }
}
