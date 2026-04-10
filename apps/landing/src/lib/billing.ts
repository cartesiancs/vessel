export async function cancelSubscription(accessToken: string) {
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancel-subscription`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to cancel subscription");
  }

  return data;
}
