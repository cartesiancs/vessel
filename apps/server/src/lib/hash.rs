pub fn hash_password(password: &str) -> Result<String, bcrypt::BcryptError> {
    let cost = 12;
    bcrypt::hash(password, cost)
}

pub fn verify_password(password: &str, hashed_password: &str) -> Result<bool, bcrypt::BcryptError> {
    bcrypt::verify(password, hashed_password)
}