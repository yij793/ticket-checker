import dotenv from 'dotenv';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

import login from './login.js';
import { 
    randomDelay,
} from './common.js';

import {
  clickAccordionAndButton,
  rescheduleAppointment,
  findRelatedName
} from './reschedule.js'

// 初始化 puppeteer
puppeteer.use(StealthPlugin());
// 加载环境变量
dotenv.config();
let appointmentDates = null; 


/**
 * 启动浏览器 + 打开页面封装
 */
async function launchBrowser() {
    const args = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        // `--proxy-server=${proxy.ip}`
    ];

    const browser = await puppeteer.launch({
        headless: 'new',
        args: args
    });

    const page = await browser.newPage();

    // 设置代理认证
    // if (proxy.username && proxy.password) {
    //     await page.authenticate({
    //         username: proxy.username,
    //         password: proxy.password
    //     });
    // }

    // 设置伪装参数
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1 });
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

    // 清除缓存、cookie、localStorage 等
    const client = await page.target().createCDPSession();
    await client.send('Network.clearBrowserCookies');
    await client.send('Network.clearBrowserCache');
    

    return { browser, page };
}

async function checkTickets(page, browser) {
    console.log(`👉 检查日期: ${process.env.US_END_DATE}`);
    console.log(`👤 使用账号: ${process.env.LOGIN_EMAIL}`);

    appointmentDates = null
    const apiPattern = '/appointment/days/94.json';

    try {
        await login(page);
        await findRelatedName(process.env.US_TARGET_NAME, page);

        const waitForApi = page.waitForResponse(res =>
            res.url().includes('/appointment/days/94') && res.status() === 200
          );
          
          const clicked = await clickAccordionAndButton(page, "Reschedule Appointment", "Reschedule Appointment");
          if (!clicked) {
            console.error("❌ Reschedule Appointment 不存在，停止");
            return;
          }
          
          // 等待 API 响应并安全解析
          appointmentDates = null;
          try {
            const response = await waitForApi;
            const text = await response.text(); // ✅ 用 text 防止解析失败
            appointmentDates = JSON.parse(text);
          } catch (err) {
            console.error("❌ 解析 API 失败:", err.message);
          }
          
          if (!appointmentDates || appointmentDates.length === 0) {
            console.error("❌ 没有捕获到预约日期");
            return;
          }
          
          console.log("✅ 捕获到预约日期:", appointmentDates.map(d => d.date));
          
        console.log('捕获到日期API');
        

        await rescheduleAppointment(page, appointmentDates)

    } catch (err) {
        console.error('❌ 出错啦：', err);
        stop(browser)
    } finally {
        await browser.close();
    }
}

function stop(browser) {
  browser.close()
}

/**
 * 无限循环+错误重启机制
 */
async function startLoop() {
    while (true) {
        let browser
        try {
            const result = await launchBrowser();
            browser = result.browser;
            const page = result.page;
            await checkTickets(page, browser);
        } catch (error) {
            console.error('🚨 脚本崩溃，正在重启：', error);
        } finally {
            browser.close()
        }
        console.log('🕒 5-8分钟后再检查...');
        await randomDelay(300000, 480000)
    }
}

// 启动程序
startLoop();
