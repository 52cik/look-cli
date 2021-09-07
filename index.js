const fs = require('fs');
const got = require('got');
const ora = require('ora');

const spinner = ora('loading...').start();
const startTime = Date.now();

const args = process.argv.slice(2);

const url = args.find((it) => it.startsWith('http'));
const json = args.some((it) => it === '--json');

if (!url) {
  spinner.fail('invalid url');
  process.exit(1);
}

const filterUrl = url => !/(?:\.(map|html?)$|^(?:service-worker\.js|index\.html|precache-manifest|\/static\/js\/lib\.dll))/.test(url);

(async () => {
  let files = [];

  try {
    const res = await got
      .get(`${url.replace(/\/$/, '')}/asset-manifest.json`)
      .json();
    files = res.files;
  } catch (er) {
    spinner.fail('asset-manifest not found');
    return;
  }

  const urls = Object.entries(files)
    .filter((it) => filterUrl(it[0]))
    // .filter(it => /^static\//.test(it[0]))
    .map((it) => it[1]);

  const notFound = [];

  await Promise.all(
    urls.map((url) =>
      got.head(url).catch((er) => {
        notFound.push({ code: er.response.statusCode, url });
      })
    )
  );

  const endTime = Date.now();

  const msg = `done in ${(endTime - startTime) / 1000}s, succeed ${urls.length - notFound.length}/${urls.length} files.`;

  if (json) {
    fs.writeFileSync('report.json', JSON.stringify({ 200: urls, 404: notFound }, null, 2), 'utf8');
    spinner.succeed(`${msg} [generated report.json]`);
    return;
  }

  const msg2 = notFound.map((it) => `${it.code} ${it.url}`).join('\n');
  spinner.succeed(`${msg}\n${msg2}`);
})().catch((err) => {
  spinner.fail(`fail [${err.message}]`);
});
