
import test from "node:test";
import assert from "node:assert/strict";

const BASE_URL = "http://localhost:5000";

// Test 1: Unauthenticated users cannot access admin APIs
test("Unauthenticated users cannot access admin APIs", async () => {
  const response = await fetch(
    `${BASE_URL}/api/admin/onboarding/pending`
  );

  assert.equal(response.status, 401);
});

// Test 2: Unauthenticated users cannot access customer profile
test("Unauthenticated users cannot access customer profile", async () => {
  const response = await fetch(
    `${BASE_URL}/api/auth/me`
  );

  assert.equal(response.status, 401);
});

// Test 3: Customers cannot access admin APIs
test("Customer cannot access admin APIs", async () => {
  const customerToken = process.env.BV_TEST_CUSTOMER_TOKEN;

  assert.ok(
    customerToken,
    "Set BV_TEST_CUSTOMER_TOKEN before running this test"
  );

  const response = await fetch(
    `${BASE_URL}/api/admin/onboarding/pending`,
    {
      headers: {
        Authorization: `Bearer ${customerToken}`,
      },
    }
  );

  assert.equal(response.status, 403);
});
