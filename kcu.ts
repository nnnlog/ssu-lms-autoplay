import {chromium, Page} from "playwright";
import configDotenv from "dotenv";

configDotenv.config();

const closePopup = async (page: Page) => {
    while (await page.locator("#close").first().isVisible()) {
        await page.locator("#close").first().click();
        await new Promise(r => setTimeout(r, 1000));
    }
};

const login = async (page: Page) => {
    await page.goto("https://portal.kcu.ac/");
    await page.waitForURL((s: URL) => s.toString().startsWith("https://portal.kcu.ac/html/main/ssoko.html?result="));

    await closePopup(page);

    await page.fill("#userId", process.env.KCU_ID!);
    await page.fill("#userPw", process.env.KCU_PW!);

    await page.locator("#loginBtnUserId").click();
    await page.waitForURL("https://portal.kcu.ac/html/main/index.html?portalPage=portal_main");

    await closePopup(page);
    await page.locator(".link_room").first().click();
    await page.waitForURL("https://lms.kcu.ac/dashBoard/std");
    await page.waitForLoadState("domcontentloaded");
    await closePopup(page);
};

const getLectureRooms = async (page: Page) => {
    const ret: { url: string, body: string }[] = [];
    const lectures = await page.locator(".lectureList > li").all();
    for (let lecture of lectures) {
        const status = await lecture.locator("span").first().innerText();
        if (status === "학습전" || status === "학습중") {
            const wait = new Promise<{ url: string, body: string }>(resolve => page.route("**/*", async (route) => {
                const url = route.request().url();
                const body = route.request().postData();

                if (body === null) return;

                await route.abort();
                await page.unrouteAll();

                await page.goBack();

                resolve({url, body});
            }));

            await lecture.locator("button").first().click();
            ret.push(await wait);
            // break;
        }
    }

    return ret;
};

const playVideo = async (page: Page, url: string, body: string) => {
    // await page.request.post(url, {data: body});
    await page.goto(`${url}?${body}`);

    const iframe = page.frameLocator("#cndIfram").first().locator(":root");

    while (!(await iframe.evaluate(() => "jsPlayer" in window))) {
        await new Promise(r => setTimeout(r, 10));
    }

    console.log("jsPlayer is ready");

    // @ts-ignore
    while (await iframe.evaluate(() => jsPlayer.remainingTime()) > 1) {
        await new Promise(r => setTimeout(r, 1000));
        // @ts-ignore
        console.log(await iframe.evaluate(() => jsPlayer.remainingTime()));
    }
};

(async () => {
    const browser = await chromium.launch({
        headless: false,
        channel: "chrome"
    });
    const page = await browser.newPage();

    await login(page);

    const lectureRooms = await getLectureRooms(page);
    console.log(lectureRooms);

    for (let {url, body} of lectureRooms) {
        await playVideo(page, url, body);
    }

    await browser.close();
})();
