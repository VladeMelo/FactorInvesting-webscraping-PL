const puppeteer = require('puppeteer');

const sleep = seconds =>
  new Promise(resolve => setTimeout(resolve, (seconds || 1) * 1000))

const execute = async () => {
  const browser = await puppeteer.launch({
    headless: false,
  });
  const page = await browser.newPage();

  const findingAndFixingNumber = async(selector) => {
    let waitingNumber = await page.waitForSelector(selector, {
      timeout: 60000
    })
    .then(number => number.getProperty('innerText').then(numberInMillion => numberInMillion.jsonValue()))
    .catch(() => '-');

    if (waitingNumber !== '-') {
      waitingNumber = waitingNumber.replace(',', '') / 100;
    }
  
    return waitingNumber;
  }

  const sections = [
    '1/bens-industriais',
    '2/consumo-ciclico',
    '3/consumo-nao-ciclico',
    '4/financeiro-e-outros',
    '5/materiais-basicos',
    '6/petroleo-gas-e-biocombustiveis',
    '7/saude',
    '8/tecnologia-da-informacao',
    '9/comunicacoes',
    '10/utilidade-publica'
  ];
  const allTickers = [];

  for (let x = 0 ; x < sections.length ; x++) {
    await page.goto(`https://statusinvest.com.br/acoes/setor/${sections[x]}`);

    await page.select(`#main-2 > div > div > div.input-field.w-100.w-sm-50.w-md-15.pb-2.pr-sm-3 > div > select`, '1'); // to select the category "Ações"

    await page.select('#total-page-2', '-1'); // to select the category "TODOS"

    await sleep(3); // just to guarantee

    const tickersSection = await page.$$eval('#companies > div.list.d-md-flex.flex-wrap.justify-between > div > div > div.info.w-100 > span > a', list => list.map(ticker => ticker.outerText));

    const tickersWithRestrictions = tickersSection.reduce((total, ticker) => {
      if (total.length !== 0 && (ticker.slice(0, -1) === total[total.length - 1].slice(0, -1) || ticker.length > 5)) {
        // guarantee one ticker per stock and removes tickers with code greater than 9 
        return total;
      }

      total.push(ticker);
      return total;
    }, []);

    allTickers.push(...tickersWithRestrictions);
  }

  const tickerWithPl = [];

  for (let y = 0 ; y < allTickers.length ; y++) {
    await page.goto(`https://statusinvest.com.br/acoes/${allTickers[y]}`);

    const waitingDailyLiquidity = await page.waitForSelector('#main-2 > div:nth-child(4) > div > div:nth-child(4) > div > div > div:nth-child(3) > div > div > div > strong', {
      timeout: 60000
    })
    .then(dailyLiquidity => dailyLiquidity.getProperty('innerText').then(liquidity => liquidity.jsonValue()))
    .catch(() => '-');

    const button = await page.$('#indicators-section > div.d-md-flex.align-items-center.justify-between.mb-3 > div > button:nth-child(2)');
    await button.evaluate(button => button.click()); // to open the record

    const lastLpa = await findingAndFixingNumber ('#indicators-section > div.indicator-historical-container > div:nth-child(2) > div > div.table-scroll.w-100 > div > div:nth-child(12) > div:nth-child(3)')

    const currentLpa = await findingAndFixingNumber('#indicators-section > div.indicator-historical-container > div:nth-child(2) > div > div.table-scroll.w-100 > div > div:nth-child(12) > div:nth-child(2)')

    if (waitingDailyLiquidity !== '-' && lastLpa !== '-' && currentLpa !== '-') { // removing stocks that don't 'exist' anymore
      const waitingPrice = await page.waitForSelector('#main-2 > div:nth-child(4) > div > div.pb-3.pb-md-5 > div > div.info.special.w-100.w-md-33.w-lg-20 > div > div:nth-child(1) > strong', {
        timeout: 60000
      })
      .then(actualPrice => actualPrice.getProperty('innerText').then(price => price.jsonValue()))
      .catch(() => 0);

      const pl = Number(((waitingPrice.replace(',', '') / 100) / ((lastLpa + currentLpa) / 2)).toFixed(2));

      tickerWithPl.push({
        ticker: allTickers[y],
        liquidity: waitingDailyLiquidity,
        pl
      });
    }
  }
  tickerWithPl.forEach(e => console.log(e));
}

execute();