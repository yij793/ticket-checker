export const siteConfig = {
  // 网站基本配置
  baseUrl: process.env.LOGIN_URL,
  
  // 登录页面相关选择器
  loginSelectors: {
    usernameInput: '#username',
    passwordInput: '#password',
    loginButton: '#login-button'
  },
  
  // 订票页面相关选择器
  ticketSelectors: {
    bookTicketsButton: '#book-tickets',
    datePicker: '.date-picker',
    datePickerInput: '.datepicker-input',
    ticketStatus: '.ticket-status'
  },
  
  // 自定义导航步骤
  navigationSteps: [
    {
      name: '进入订票页面',
      action: 'click',
      selector: '#book-tickets',
      waitForSelector: true
    },
    {
      name: '打开日期选择',
      action: 'click',
      selector: '.date-picker',
      waitForSelector: true
    }
  ],
  
  // 日期配置
  dateConfig: {
    targetDate: process.env.TARGET_DATE || '2024-05-01', // 从环境变量获取目标日期
    allowEarlier: true,
    dateFormat: 'YYYY-MM-DD'
  }
};

// 日期工具函数
export const dateUtils = {
  isDateValid: (dateStr, targetDate, allowEarlier) => {
    const date = new Date(dateStr);
    const target = new Date(targetDate);
    
    if (allowEarlier) {
      return date <= target;
    }
    return date.toDateString() === target.toDateString();
  },
  
  formatDate: (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
};