use ckb_std::error::SysError;

/// Error codes for the market-item-type script.
/// Codes 0-19 are reserved for ckb-std SysError mapping.
#[repr(i8)]
pub enum Error {
    IndexOutOfBound = 1,
    ItemMissing = 2,
    LengthNotEnough = 3,
    Encoding = 4,
    // Custom errors start at 20
    InvalidMarketItemData = 20,
    EmptyContentType = 21,
    EmptyDescription = 22,
    EmptyContent = 23,
    ContentTypeChanged = 24,
    ContentChanged = 25,
    InvalidMimeFormat = 26,
}

impl From<SysError> for Error {
    fn from(err: SysError) -> Self {
        match err {
            SysError::IndexOutOfBound => Error::IndexOutOfBound,
            SysError::ItemMissing => Error::ItemMissing,
            SysError::LengthNotEnough(_) => Error::LengthNotEnough,
            SysError::Encoding => Error::Encoding,
            SysError::Unknown(code) => panic!("unexpected sys error {}", code),
        }
    }
}
