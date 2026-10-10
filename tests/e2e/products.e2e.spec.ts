import { expect, test } from "@playwright/test";

test.describe("Products CRUD (E2E, local SAM + DynamoDB Local)", () => {
  test("full lifecycle: create → get → list → update → delete", async ({ request }) => {
    const createRes = await request.post("/products", {
      data: { name: "E2E Keyboard", description: "playwright", price: 79.9, stock: 5 },
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    const id: string = created.product.id;
    expect(id).toBeTruthy();

    const getRes = await request.get(`/products/${id}`);
    expect(getRes.status()).toBe(200);
    expect((await getRes.json()).product.name).toBe("E2E Keyboard");

    const listRes = await request.get("/products?limit=10");
    expect(listRes.status()).toBe(200);
    expect((await listRes.json()).products.length).toBeGreaterThan(0);

    const updateRes = await request.put(`/products/${id}`, { data: { price: 99.9 } });
    expect(updateRes.status()).toBe(200);
    expect((await updateRes.json()).product.price).toBe(99.9);

    const deleteRes = await request.delete(`/products/${id}`);
    expect(deleteRes.status()).toBe(200);

    const goneRes = await request.get(`/products/${id}`);
    expect(goneRes.status()).toBe(404);
  });

  test("rejects invalid product data with 400", async ({ request }) => {
    const res = await request.post("/products", {
      data: { name: "", price: -1, stock: -2 },
    });
    expect(res.status()).toBe(400);
  });
});
