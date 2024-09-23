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
    await page.goto("https://lms.kcu.ac/dashBoard/std");
    await page.waitForURL((s: URL) => s.toString().startsWith("https://portal.kcu.ac/html/main/ssoko.html?returnUrl="));
    await page.waitForLoadState("domcontentloaded");

    await page.fill("#userId", process.env.KCU_ID!);
    await page.fill("#userPw", process.env.KCU_PW!);
    await page.evaluate("document.getElementById('loginBtnUserId').click()");

    {
        let ok: boolean;
        do {
            ok = false;
            await page.locator("#loginBtnUserId").first().click({
                timeout: 1000,
            }).then(() => {
                ok = true;
                console.log("clicked");
            }).catch((e) => {
                // closePopup(page);
                console.log(page.locator("#loginBtnUserId").first().isVisible())
                console.log(e);
            });
        } while (!ok);
    }
    await page.waitForURL("https://lms.kcu.ac/dashBoard/std");
    await page.waitForLoadState("domcontentloaded");

    await page.waitForLoadState("domcontentloaded");
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

            {
                let ok: boolean;
                do {
                    ok = false;
                    await lecture.locator("button").first().click({
                        timeout: 1000,
                    }).then(() => ok = true).catch(() => closePopup(page));
                } while (!ok);
            }
            ret.push(await wait);
        }
    }

    return ret;
};

const playVideo = async (page: Page, url: string, body: string) => {
    const jsPlayer: any = {};
    await page.goto(`${url}?${body}`);

    const iframe = page.frameLocator("#cndIfram").first().locator(":root");

    while (!(await iframe.evaluate(() => "jsPlayer" in window))) {
        await new Promise(r => setTimeout(r, 10));
    }

    console.log("jsPlayer is ready");
    await iframe.evaluate(() => jsPlayer.play());

    while (!(await iframe.evaluate(() => jsPlayer.ended()))) {
        await new Promise(r => setTimeout(r, 1000));
        console.log(await iframe.evaluate(() => jsPlayer.remainingTime()));
    }

    console.log("jsPlayer is ended");
};

(async () => {
    const browser = await chromium.launch({
        headless: process.env["HEADLESS"]?.toLowerCase() === "true",
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
