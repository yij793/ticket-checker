import { randomDelay } from "./common.js";

async function findRelatedName(targetName, page) {
  try {
    if (page.isClosed()) {
      console.error('❌ 页面已关闭，跳过 findRelatedName');
      return;
    }

    // 注入反 Puppeteer 检测脚本
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
    });

    // 等待页面加载并确认登录状态
    await page.waitForSelector('#user_email', { timeout: 3000}).catch(() => {
      console.warn('⚠️ 页面未找到 #user_email, 已跳过登录页');
    });

    // 尝试找到包含目标姓名的 continue 链接
    const continueUrl = await page.$$eval('.application.attend_appointment.card.success', (cards, name) => {
      name = name.toLowerCase();
      for (const card of cards) {
        if (card.innerText.toLowerCase().includes(name)) {
          const button = card.querySelector('a.button.primary');
          return button?.getAttribute('href');
        }
      }
      return null;
    }, targetName);

    if (continueUrl) {
      console.log('🔗 找到 Continue 按钮链接:', continueUrl);
      // await page.goto(`https://ais.usvisa-info.com${continueUrl}`, { waitUntil: 'networkidle2' });
      return continueUrl
    } else {
      console.error('❌ 没有找到匹配姓名的 Continue 按钮');
    }

  } catch (err) {
    if (err.message.includes('Target closed')) {
      console.error('❌ Puppeteer 页面已被关闭，跳过当前流程');
    } else {
      console.error('❌ findRelatedName 发生异常：', err);
    }
  }
}



async function clickAccordionAndButton(page, accordionText, buttonText) {
  try {
    // 等待 accordion 元素加载
    await page.waitForSelector('a.accordion-title', { timeout: 10000 });
    const accordionClicked = await page.evaluate((accordionText) => {
      const accordions = document.querySelectorAll('a.accordion-title');
      for (const accordion of accordions) {
        if (accordion.innerText.includes(accordionText)) {
          accordion.click();
          return true;
        }
      }
      return false;
    }, accordionText);

    if (!accordionClicked) {
      console.error(`❌ 找不到包含 "${accordionText}" 的 Accordion`);
      return false; // 如果找不到，结束函数
    }
    console.log(`✅ 找到并点击包含 "${accordionText}" 的 Accordion`);

    // 等待 button 元素加载
    await page.waitForSelector('a.button.small.primary.small-only-expanded', { timeout: 5000 });
    const buttonClicked = await page.evaluate((buttonText) => {
      const links = document.querySelectorAll('a.button.small.primary.small-only-expanded');
      for (const link of links) {
        if (link.innerText.includes(buttonText)) {
          link.click();
          return true;
        }
      }
      return false;
    }, buttonText);

    if (!buttonClicked) {
      console.error(`❌ 找不到包含 "${buttonText}" 的 Button`);
      return false; // 如果找不到，结束函数
    }
    console.log(`✅ 找到并点击包含 "${buttonText}" 的 Button`);
    return true

  } catch (err) {
    console.error('❌ 发生错误:', err);
    return false
  }
}

/**
 * 在 jQuery UI datepicker 中选定某个日期
 * @param {object} page - Puppeteer 的 page 实例
 * @param {string} dateStr - 日期字符串（如 '2027-06-12'）
 */
async function selectDate(page, dateStr) {
  const date = new Date(dateStr);

  if (!(date instanceof Date) || isNaN(date)) {
    throw new Error(`❌ selectDate(): 无效的日期字符串 "${dateStr}"`);
  }

  const targetMonth = date.toLocaleString('en-US', { month: 'long' });
  const targetYear = date.getFullYear();
  const targetDay = parseInt(dateStr.slice(-2), 10);

  // 打开日历控件
  await page.waitForSelector('#appointments_consulate_appointment_date', { visible: true, timeout: 20000 });
  await page.click('#appointments_consulate_appointment_date');
  await page.waitForSelector('#ui-datepicker-div', { visible: true, timeout: 20000 });

  const timeoutMs = 60000; // 最长等待 60 秒
  const startTime = Date.now();

  // 翻页到目标月份
  console.log("✅ 找到日历，开始翻页到指定日期")
  while (true) {
    // 超时检查
    if (Date.now() - startTime > timeoutMs) {
      throw new Error('❌ 超时：未能在规定时间内找到目标月份');
    }
    const month = await page.$eval('.ui-datepicker-month', el => el.innerText.trim());
    const year = await page.$eval('.ui-datepicker-year', el => el.innerText.trim());
    
    const current = `${month} ${year}`;
    const target = `${targetMonth} ${targetYear}`;
    
    if (current === target) {
      break;
    }
    
    const nextBtn = await page.$('.ui-datepicker-next');
    if (!nextBtn) {
      throw new Error('❌ 找不到“下个月”按钮');
    }
    await nextBtn.click();
    await randomDelay();
  }

  // 点击目标日期（必须是可选的）
  const dayButtons = await page.$$(`#ui-datepicker-div td:not(.ui-state-disabled):not(.ui-datepicker-unselectable) a`);

  let matchedElement = null;
  
  for (const el of dayButtons) {
    const text = await page.evaluate(el => el.textContent.trim(), el);
    if (text === String(targetDay)) {
      matchedElement = el;
      break;
    }
  }
  
  if (!matchedElement) {
    throw new Error(`❌ 没找到可点击日期 ${targetDay}`);
  }
  
  // await matchedElement.click();
  // await page.evaluate(el => el.click(), matchedElement);
  const expectedUrlPart = `/appointment/times/94.json?date=`;

  const [response] = await Promise.all([
    page.waitForResponse(response =>
      response.url().includes(expectedUrlPart) && response.status() === 200,
      { timeout: 5000 }
    ),
    matchedElement.click({ delay: 100 })
  ]);

  console.log(`✅ 点击成功，触发了日期 API，响应状态：${response.status()}`);

  console.log(`✅ 成功点击日期 ${targetDay}`);
}



async function rescheduleAppointment(page, appointmentDates) {

    const startDateStr = process.env.US_START_DATE
    const endDateStr = process.env.US_END_DATE

    // 3. 选日期
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    
    // ✅ 查找日期
    const target = appointmentDates.find(dateStr => {
      const date = new Date(dateStr.date);
      return date >= startDate && date <= endDate;
    });
    
    if (!target) {
        console.log('❌ 指定区间内无可预约日期。');
        return;
    }

  console.log(`📅 准备重新安排预约...最近日期为${target.date}`);

  // 1. 确认 Consulate 是 Toronto
  await page.waitForSelector('#appointments_consulate_appointment_facility_id');
  const selectedLocation = await page.$eval('#appointments_consulate_appointment_facility_id', el => el.value);
  const selectedText = await page.$eval(
    '#appointments_consulate_appointment_facility_id',
    el => el.selectedOptions[0].text
  );
  
  if (selectedLocation !== '94') {
    console.log('✅ 切换到 Toronto');
    await page.select('#appointments_consulate_appointment_facility_id', '94');
    await randomDelay();
  } else {
    console.log('✅ Toronto 已经选中');
  }
  if (selectedText !== 'Toronto') {
    throw new Error(`Toronto no longer 94, need recheck ${selectedLocation}`);
  }

  console.log("✅ 填写日期")
  // ✅ 填写日期
  await selectDate(page, target.date)

  // 4. 选时间段
  await page.waitForSelector('#appointments_consulate_appointment_time');
  const options = await page.$$('#appointments_consulate_appointment_time option');

  if (options.length <= 1) {
    console.error('❌ 没有可用时间段！停止。');
    throw new Error('No available time slots');
  }

  const firstAvailableTimeValue = await page.evaluate(option => option.value, options[1]);
  await page.select('#appointments_consulate_appointment_time', firstAvailableTimeValue);
  console.log('⏰ 选择第一个可用时间:', firstAvailableTimeValue);

  await page.waitForTimeout(500); 

  let dialogHandled = false;

  page.once('dialog', async dialog => {
    dialogHandled = true;
    console.log(`💬 弹窗内容: ${dialog.message()}`);
    await dialog.accept(); // 点击“确认”
  });
  // 5. 确认提交按钮 enable
  await page.waitForSelector('#appointments_submit:not([disabled])');

  if (!dialogHandled) {
    console.log('🔔 没有弹窗出现');
  }

  // 6. 点击提交按钮
  await page.click('#appointments_submit');
  console.log('✅ 成功提交Reschedule!');

  console.log(`✅ 已成功 Reschedule, 停止脚本...`);
  process.exit(0);
}

  
  export {
    clickAccordionAndButton,
    rescheduleAppointment,
    findRelatedName
};