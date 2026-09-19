import { expect, test } from "@playwright/test";

test("lunar assistant sends scene context and renders NDJSON responses", async ({
  page,
}) => {
  let requestBody: {
    messages: { role: string; content: string }[];
    context: Record<string, unknown>;
  } | null = null;

  await page.route("**/api/lunar-chat", async (route) => {
    requestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/x-ndjson" },
      body: [
        JSON.stringify({
          type: "sources",
          sources: [{ id: "gravity", title: "月球重力数据目录" }],
        }),
        JSON.stringify({ type: "delta", content: "月球当前场景已收到。" }),
        JSON.stringify({ type: "delta", content: "可以结合选中的科研图层继续分析。" }),
        JSON.stringify({ type: "done" }),
      ].join("\n") + "\n",
    });
  });

  await page.goto("/");
  await page.getByText("场景已就绪").waitFor();
  await page.getByRole("button", { name: "月球智能体", exact: true }).click();
  await expect(
    page.getByRole("complementary", { name: "月球智能体", exact: true }),
  ).toBeVisible();

  await page
    .getByLabel("向月球智能体提问", { exact: true })
    .fill("当前月球场景有哪些科研数据？");
  await page.getByRole("button", { name: "发送提问", exact: true }).click();

  const messages = page.locator('[data-testid="assistant-message"]');
  await expect(messages).toHaveCount(2);
  await expect(messages.nth(1)).toContainText("月球当前场景已收到。");
  await expect(messages.nth(1)).toContainText("可以结合选中的科研图层继续分析。");
  await expect(page.locator('[data-testid="assistant-sources"]')).toContainText(
    "月球重力数据目录",
  );

  expect(requestBody?.messages.at(-1)).toEqual({
    role: "user",
    content: "当前月球场景有哪些科研数据？",
  });
  expect(requestBody?.context).toEqual(
    expect.objectContaining({
      scene: expect.anything(),
      epoch: expect.anything(),
      scientificLayers: expect.any(Array),
    }),
  );
});

test("lunar assistant presents a server error without a page exception", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/lunar-chat", async (route) => {
    await route.fulfill({
      status: 503,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "智能体服务暂时不可用" }),
    });
  });

  await page.goto("/");
  await page.getByText("场景已就绪").waitFor();
  await page.getByRole("button", { name: "月球智能体", exact: true }).click();
  await page
    .getByLabel("向月球智能体提问", { exact: true })
    .fill("请查询月球重力数据");
  await page.getByRole("button", { name: "发送提问", exact: true }).click();

  await expect(page.locator('[data-testid="assistant-error"]')).toContainText(
    "智能体服务暂时不可用",
  );
  expect(errors).toEqual([]);
});

test("lunar assistant keeps history when reopened and remains available after a scene switch", async ({
  page,
}) => {
  await page.route("**/api/lunar-chat", async (route) => {
    await route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/x-ndjson" },
      body:
        [
          JSON.stringify({ type: "delta", content: "已记录这次月球场景问答。" }),
          JSON.stringify({ type: "done" }),
        ].join("\n") + "\n",
    });
  });

  await page.goto("/");
  await page.locator(".cesium-surface canvas").waitFor();
  await page.getByRole("button", { name: "月球智能体", exact: true }).click();
  await page
    .getByLabel("向月球智能体提问", { exact: true })
    .fill("请记住这次问答");
  await page.getByRole("button", { name: "发送提问", exact: true }).click();
  await expect(page.locator('[data-testid="assistant-message"]')).toHaveCount(2);

  await page.getByRole("button", { name: "关闭操作面板", exact: true }).click();
  await expect(
    page.getByRole("complementary", { name: "月球智能体", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "月球智能体", exact: true }).click();
  await expect(page.locator('[data-testid="assistant-message"]')).toHaveCount(2);
  await expect(page.locator('[data-testid="assistant-message"]').nth(1)).toContainText(
    "已记录这次月球场景问答。",
  );

  await page.getByRole("button", { name: "清空对话", exact: true }).click();
  await expect(page.locator('[data-testid="assistant-message"]')).toHaveCount(0);

  await page.getByRole("button", { name: "内部与演化", exact: true }).click();
  await expect(page.getByRole("button", { name: "月球智能体", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "月球智能体", exact: true }).click();
  await expect(
    page.getByRole("complementary", { name: "月球智能体", exact: true }),
  ).toBeVisible();

  for (const width of [760, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
  }
});
