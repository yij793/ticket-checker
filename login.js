import { randomDelay, humanType, hasCaptcha } from './common.js';

/**
 * 登录功能模块
 */
async function login(page) {
    try {
        await page.goto(process.env.LOGIN_URL, { waitUntil: 'networkidle2' });
        // await page.evaluate(() => {
        //     localStorage.clear();
        //     sessionStorage.clear();
        // });
        if (await hasCaptcha(page)) {
            console.warn('⚠️ 登录页出现验证码，终止登录流程');
            return;
        }

        await page.waitForSelector('#user_email');
        await page.waitForSelector('#user_password');

        await humanType(page, '#user_email', process.env.LOGIN_EMAIL);
        await randomDelay();
        await humanType(page, '#user_password', process.env.LOGIN_PASSWORD);

        const checkbox = await page.$('#policy_confirmed');
        if (checkbox) {
            const box = await checkbox.boundingBox();
            if (box) {
                await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
                await randomDelay();
                await checkbox.click();
                await randomDelay();
            }
        }

        const loginButton = await page.$('input[name="commit"]');
        if (loginButton) {
            const loginBox = await loginButton.boundingBox();
            if (loginBox) {
                await page.mouse.move(loginBox.x + loginBox.width / 2, loginBox.y + loginBox.height / 2, { steps: 10 });
                await randomDelay();
                await loginButton.click();
            }
        }

        await page.waitForNavigation({ waitUntil: 'networkidle2' });

        if (page.url().includes('/sign_in')) {
            throw new Error('❌ 登录后仍停留在登录页，疑似登录失败');
        }

        if (page.isClosed()) {
            throw new Error('❌ 页面已关闭，可能浏览器崩溃或被检测拦截');
        }

        if (await hasCaptcha(page)) {
            console.warn('⚠️ 登录后出现验证码，流程中断');
            return;
        }

        console.log('✅ 登录成功');
    } catch (err) {
        if (err.message.includes('Target closed')) {
            throw new Error('❌ Puppeteer 页面目标已关闭（Target closed），可能是崩溃或被网站主动拦截。');
        } else {
            throw new Error('❌ 登录失败：', err);
        }

    }
}  

export default login;