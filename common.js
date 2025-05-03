/**
 * 随机延迟函数
 */
function randomDelay(min = 300, max = 800) {
    const timeout = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, timeout));
}

/**
 * 模拟人类打字函数
 */
async function humanType(page, selector, text) {
    await page.focus(selector);
    for (const char of text) {
        await page.keyboard.type(char);
        await randomDelay(50, 150); // 每个字符随机延迟
    }
}



async function isPageBusy(page) {
    const busy = await page.evaluate(() => {
        return !!document.querySelector('.timeslot-busy') || document.querySelectorAll('.available-timeslot').length === 0;
    });
    return busy;
}

async function hasCaptcha(page) {
    const recaptcha = await page.$('iframe[src*="recaptcha"]');
    const slider = await page.$('.slider-captcha'); // 示例
    return recaptcha || slider;
  }




export {
    randomDelay,
    humanType,
    isPageBusy,
    hasCaptcha,
};