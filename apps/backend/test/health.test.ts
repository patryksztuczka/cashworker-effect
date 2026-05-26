import app from "../src/index";

describe("backend app", () => {
  it("returns text from the root route", async () => {
    const response = await app.request("/");

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("cashworker backend");
  });

  it("runs the health route through Effect", async () => {
    const response = await app.request("/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      service: "backend",
      runtime: "cloudflare-workers",
    });
  });
});
