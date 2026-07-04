use chrono::{NaiveDateTime, Utc};
use diesel::{Connection, ExpressionMethods, OptionalExtension, QueryDsl, RunQueryDsl, SelectableHelper};

use crate::{
    db::models::{NewRefreshToken, RefreshToken},
    state::DbPool,
};

pub fn insert_refresh_token(
    pool: &DbPool,
    target_user_id: i32,
    target_family_id: &str,
    hashed_token: &str,
    expiry: NaiveDateTime,
) -> Result<RefreshToken, anyhow::Error> {
    use crate::db::schema::refresh_tokens::dsl::*;
    let mut conn = pool.get()?;

    let new_token = NewRefreshToken {
        user_id: target_user_id,
        family_id: target_family_id,
        token_hash: hashed_token,
        expires_at: expiry,
    };

    let token = diesel::insert_into(refresh_tokens)
        .values(&new_token)
        .get_result(&mut conn)?;

    Ok(token)
}

pub fn find_refresh_token_by_hash(
    pool: &DbPool,
    hashed_token: &str,
) -> Result<Option<RefreshToken>, anyhow::Error> {
    use crate::db::schema::refresh_tokens::dsl::*;
    let mut conn = pool.get()?;

    let token = refresh_tokens
        .filter(token_hash.eq(hashed_token))
        .select(RefreshToken::as_select())
        .first::<RefreshToken>(&mut conn)
        .optional()?;

    Ok(token)
}

/// Atomically consume `old_id` (only if still unused) and issue a fresh token in
/// the same family. Returns `Ok(None)` when the old token was already consumed by
/// a concurrent request (a reuse signal — caller should revoke the family).
pub fn rotate_refresh_token(
    pool: &DbPool,
    old_id: i32,
    target_user_id: i32,
    target_family_id: &str,
    new_hashed_token: &str,
    new_expiry: NaiveDateTime,
) -> Result<Option<RefreshToken>, anyhow::Error> {
    use crate::db::schema::refresh_tokens::dsl::*;
    let mut conn = pool.get()?;

    let result = conn.transaction::<Option<RefreshToken>, anyhow::Error, _>(|conn| {
        let now = Utc::now().naive_utc();
        let marked = diesel::update(
            refresh_tokens
                .filter(id.eq(old_id))
                .filter(used_at.is_null()),
        )
        .set(used_at.eq(now))
        .execute(conn)?;

        if marked == 0 {
            return Ok(None);
        }

        let new_token = NewRefreshToken {
            user_id: target_user_id,
            family_id: target_family_id,
            token_hash: new_hashed_token,
            expires_at: new_expiry,
        };

        let token = diesel::insert_into(refresh_tokens)
            .values(&new_token)
            .get_result(conn)?;

        Ok(Some(token))
    })?;

    Ok(result)
}

pub fn revoke_family(pool: &DbPool, target_family_id: &str) -> Result<usize, anyhow::Error> {
    use crate::db::schema::refresh_tokens::dsl::*;
    let mut conn = pool.get()?;

    let num_deleted =
        diesel::delete(refresh_tokens.filter(family_id.eq(target_family_id))).execute(&mut conn)?;

    Ok(num_deleted)
}

pub fn delete_expired_refresh_tokens(pool: &DbPool) -> Result<usize, anyhow::Error> {
    use crate::db::schema::refresh_tokens::dsl::*;
    let mut conn = pool.get()?;

    let now = Utc::now().naive_utc();
    let num_deleted =
        diesel::delete(refresh_tokens.filter(expires_at.lt(now))).execute(&mut conn)?;

    Ok(num_deleted)
}
