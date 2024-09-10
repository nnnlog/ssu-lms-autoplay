import {chromium, Page} from "playwright";
import configDotenv from "dotenv";

configDotenv.config();

const login = async (page: Page) => {
    await page.goto("https://smartid.ssu.ac.kr/Symtra_sso/smln.asp?apiReturnUrl=https%3A%2F%2Flms.ssu.ac.kr%2Fxn-sso%2Fgw-cb.php");

    await page.fill("#userid", process.env.LMS_ID!);
    await page.fill("#pwd", process.env.LMS_PW!);

    // @ts-ignore
    await page.evaluate(() => LoginInfoSend('LoginInfo'));
    await page.waitForURL("https://lms.ssu.ac.kr/");

    await page.goto("https://canvas.ssu.ac.kr/learningx/dashboard?user_login=20221494&locale=ko");
    await page.waitForLoadState("domcontentloaded");
};

const getApiToken = async (page: Page): Promise<string> => {
    return (await page.context().cookies("https://canvas.ssu.ac.kr")).find(cookie => cookie.name === "xn_api_token")!.value;
};

const getDefaultTerms = async (page: Page, apiToken: string): Promise<number[]> => {
    const response = await (await fetch("https://canvas.ssu.ac.kr/learningx/api/v1/users/20221494/terms?include_invited_course_contained=true", {
        headers: {
            "Authorization": `Bearer ${apiToken}`
        }
    })).json();

    return response.enrollment_terms.filter((term: any) => term.default).map((term: any) => term.id);
};

const getCourses = async (page: Page, apiToken: string): Promise<number[]> => {
    const termIds = await getDefaultTerms(page, apiToken);
    const response = await (await fetch(`https://canvas.ssu.ac.kr/learningx/api/v1/learn_activities/courses?term_ids[]=${termIds.join("&term_ids[]=")}`, {
        headers: {
            "Authorization": `Bearer ${apiToken}`
        }
    })).json();

    return response.map((course: any) => course.id);
};

const getRemainLectureMovies = async (page: Page, apiToken: string): Promise<string[]> => {
    const courses = await getCourses(page, apiToken);

    const urls: string[] = [];
    for (let course of courses) {
        const response = await (await fetch(`https://canvas.ssu.ac.kr/learningx/api/v1/courses/${course}/modules?include_detail=true`, {
            headers: {
                "Authorization": `Bearer ${apiToken}`
            },
        })).json();
        urls.push(...response.map((module: any) => {
            return module.module_items.filter((item: any) => {
                return !item.completed && item.content_type === "attendance_item" && item.content_data.use_attendance === true && item.content_data.opened;
            }).map((item: any) => {
                let playId = item.content_data.item_content_data.content_id;
                return `https://commons.ssu.ac.kr/em/${playId}?startat=0.00&endat=0.00&TargetUrl=https://canvas.ssu.ac.kr/learningx/api/v1/courses/${course}/sections/0/components/${item.content_data.item_id}/progress?user_id=${process.env.LMS_ID!}&content_id=${playId}`;
            });
        }))
    }

    return urls.flat();
};

const playMovie = async (page: Page, url: string) => {
    await page.goto(url);
    await page.waitForLoadState("domcontentloaded");

    let uniPlayer: any, bcPlayController: any, LMSState: any, sendPlayedTime: any, storyWorker: any;

    await page.locator(".vc-front-screen-play-btn").first().click();

    while (!(await page.evaluate(() => "uniPlayer" in window && typeof uniPlayer === "object"))) {
        await new Promise(r => setTimeout(r, 10));
    }

    console.log(`uniPlayer is ready`);

    while (await page.evaluate(() => {
        return uniPlayer.isCurrentStoryLastStory() === false || (bcPlayController._vcPlayController._duration - bcPlayController._vcPlayController._currTime >= 1);
    })) {
        console.log(await page.evaluate(() => {
            return bcPlayController._vcPlayController._duration - bcPlayController._vcPlayController._currTime;
        }));
        if (!(await page.evaluate(() => uniPlayer.isCurrentStoryLastStory()))) {
            await page.evaluate(() => {
                storyWorker.playNextStory();
            });
        }
        await new Promise(r => setTimeout(r, 1000));
    }

    console.log(await page.evaluate(() => {
        return [uniPlayer.isCurrentStoryLastStory(), bcPlayController._vcPlayController._duration - bcPlayController._vcPlayController._currTime, , bcPlayController._vcPlayController._duration];
    }));

    await page.evaluate(() => {
        sendPlayedTime(LMSState.UPDATE_DATA);
    });
};

(async () => {
    const browser = await chromium.launch({
        headless: process.env["HEADLESS"]?.toLowerCase() === "true",
        channel: "chrome"
    });
    const page = await browser.newPage();

    await login(page);

    const token = await getApiToken(page);

    const urls = await getRemainLectureMovies(page, token);
    console.log(urls);

    for (let url of urls) {
        await playMovie(page, url);
    }

    await browser.close();
})();
