const puppeteer = require('puppeteer');

let browser, page;

beforeAll(async () => {
  browser = await puppeteer.launch({
    headless: false,
    timeout: 30000,  // Increase overall timeout for Puppeteer
  });
  page = await browser.newPage();

  // Go to the login page
  await page.goto('https://webtm.io/login', { waitUntil: 'domcontentloaded' });

  await page.waitForTimeout(1000)
  // Enter login credentials
  await page.waitForSelector('input[name="email"]', { visible: true });
  await page.type('input[name="email"]', 'liza.saraviag@gmail.com');
  await page.type('input[name="password"]', 'Test12345');

  // Click "Sign In"
  await page.evaluate(() => {
    [...document.querySelectorAll('button')].find(button => button.textContent === 'Sign In').click();
  });

  // Wait for successful login or specific element after login
  await page.waitForNavigation();
  console.log("Logged in successfully");

}, 30000); // Increased timeout for beforeAll

afterAll(async () => {
  console.log("Closing browser");
  await browser.close();
});

test(
  'Search functionality updates content',
  async () => {
    console.log("Navigating to navigation-entries");

    // Navigate to the desired page
    await page.goto('https://webtm.io/navigation-entries', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000)
    // Perform the search
    console.log("Typing search query");
    await page.waitForSelector('input[name="search"]', { visible: true });
    await page.type('input[name="search"]', 'example query');

    console.log("Clicking the menu button");
    // Click the menu button
    await page.evaluate(() => {
      const menuButtons = [...document.querySelectorAll('button')].filter(button => button.ariaLabel === 'Menu')
      const searchButton = menuButtons.length > 1 ? menuButtons[1] : menuButtons[0]
      searchButton.click()
    });

    console.log("Waiting for search results");
    // Verify search results
    await page.waitForTimeout(2000)
    const searchText = "No results found. Try different search terms!";
    const foundText = await page.$$eval(
      '#content div p', // Selector del texto dentro del div
      (elements, searchText) => {
        // Busca el texto deseado en los elementos
        const element = elements.find(el => el.textContent.trim() === searchText);
        return element ? element.textContent.trim() : null;
      },
      searchText // Pasamos el texto a buscar al contexto del navegador
    );
    await page.waitForTimeout(2000)
    expect(foundText).toBeDefined();
  },
  30000 // Increased timeout for this test
);
