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

const getDefaultTerms = async (page: Page): Promise<number[]> => {
    const apiToken = await getApiToken(page);

    const response = await (await fetch("https://canvas.ssu.ac.kr/learningx/api/v1/users/20221494/terms?include_invited_course_contained=true", {
        headers: {
            "Authorization": `Bearer ${apiToken}`
        }
    })).json();

    return response.enrollment_terms.filter((term: any) => term.default).map((term: any) => term.id);
};

const getRemainLectureMovies = async (page: Page): Promise<string[]> => {
    const apiToken = await getApiToken(page);

    const termIds = await getDefaultTerms(page);
    const response = await (await fetch(`https://canvas.ssu.ac.kr/learningx/api/v1/learn_activities/to_dos?term_ids[]=${termIds.join("&enrollment_term_ids[]=")}`, {
        headers: {
            "Authorization": `Bearer ${apiToken}`
        },
    })).json();

    return response.to_dos.map((course: any) => {
        return course.todo_list.map((obj: any) => obj.course_id = course.course_id);
    }).flat().map((todo: any) => `https://canvas.ssu.ac.kr/learningx/redirect/courses/${todo.course_id}/external_tools/2?component_info={"section_id":${todo.section_id},"unit_id":${todo.unit_id},"component_id":${todo.component_id}&target=web`);
};

const playMovie = async (page: Page, url: string) => {
    await page.goto(url);


};

(async () => {
    const browser = await chromium.launch({headless: false});
    const page = await browser.newPage();

    await login(page);

    const urls = await getRemainLectureMovies(page);
    console.log(urls);

    for (let url of urls) {
        await playMovie(page, url);
    }

    await browser.close();
})();
