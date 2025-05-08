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
    
    await page.setCacheEnabled(false)
    return { browser, page };
}

async function checkTickets(page, browser) {
    console.log(`👉 检查日期: ${process.env.US_END_DATE}`);
    console.log(`👤 使用账号: ${process.env.LOGIN_EMAIL}`);

    appointmentDates = null
    const apiPattern = '/appointment/days/94.json';

    try {
        await login(page);
        const userUrl = await findRelatedName(process.env.US_TARGET_NAME, page);
        const newHref = userUrl.replace("continue_actions", "appointment")
        const waitForApi = page.waitForResponse(res =>
            res.url().includes('/appointment/days/94') && res.status() === 200
          );

    const maxRetries = 3;

    let attempt = 0;
    let response;

    while (attempt <= maxRetries) {
        try {
            const url = `https://ais.usvisa-info.com${newHref}`;
            response = await page.goto(url, { waitUntil: 'networkidle2' });

            if (response && response.status() !== 502) {
            console.log(`Page loaded successfully on attempt ${attempt + 1}`);
            break; // 成功加载，退出循环
            }

            if (attempt === maxRetries) {
            throw new Error(`Failed after ${maxRetries + 1} attempts. Still receiving 502 for ${url}`);
            }

            const waitMinutes = attempt + 1;
            console.warn(`Attempt ${attempt + 1} received 502. Waiting ${waitMinutes} minute(s) before retrying...`);
            await new Promise(resolve => setTimeout(resolve, waitMinutes * 60000)); // 等待 n 分钟
            attempt++;
        } catch (err) {
            if (attempt === maxRetries) {
            console.error('Final attempt failed. 页面修理.', err.message);
            throw err;
            }
            const waitMinutes = attempt + 1;
            console.warn(`Error on attempt ${attempt + 1}. Waiting ${waitMinutes} minute(s) before retrying...`);
            await new Promise(resolve => setTimeout(resolve, waitMinutes * 60000));
            attempt++;
        }
    }

          
        
        // const clicked = await clickAccordionAndButton(page, "Reschedule Appointment", "Reschedule Appointment");
        // if (!clicked) {
        //   console.error("❌ Reschedule Appointment 不存在，停止");
        //   return;
        // }
        
        // 等待 API 响应并安全解析
        appointmentDates = null;
        try {
          const response = await waitForApi;
          console.log("Response status", response.status())
          const text = await response.text(); // ✅ 用 text 防止解析失败
          appointmentDates = JSON.parse(text);
        } catch (err) {
            const e = new Error(`❌ 解析 API 失败: ${err}`);
            e.reason = 'parse_fail';
            throw e;
        }
        
        if (!appointmentDates || appointmentDates.length === 0) {
          const e2 = new Error("❌ 没有捕获到预约日期");
          e2.reason = 'no_date';
          throw e2;
        }
        
        const timeStr3 = new Date().toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: false });
        console.log(`⏰ 当前时间: ${timeStr3}, API 开放`);
        console.log("✅ 捕获到预约日期区间:", appointmentDates.map(d => d.date));
        
        

        await rescheduleAppointment(page, appointmentDates)

    } catch (err) {
        throw err;
    }
}


/**
 * 无限循环+错误重启机制
 */
async function startLoop() {
    while (true) {
        let browser
        let delay_start = 180000
        let delay_end = 300000
        const timeStr =  new Date().toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: false });
        console.log(`⏰ 当前时间: ${timeStr}`);
        try {
            const result = await launchBrowser();
            browser = result.browser;
            const page = result.page;
            await checkTickets(page, browser);
        } catch (error) {
            console.error('🚨 脚本崩溃，正在重启：', error);
            if (error.reason === 'parse_fail' || error.reason === 'no_date') {
                const failDelay = 1800000 + Math.random() * 600000;
                const timeStr2 =  new Date().toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: false });
                console.warn(`⏰ 当前时间: ${timeStr2}, API 不开放, 等待30-40分钟`);
                const start = Date.now();
                while (Date.now() - start < failDelay) {
                    await new Promise(resolve => setTimeout(resolve, 10000)); // 每10秒check一次
                }
            }
        } finally {
            if (browser) {
                browser.close()
            }
        }
        await randomDelay(delay_start, delay_end)
        console.log(`🕒 ${Math.floor(delay_start / 60000)} 到 ${Math.floor(delay_end / 60000)}  分钟后再检查...`);
        
    }
}

// 启动程序
startLoop();
