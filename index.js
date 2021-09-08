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

const re = {
  map: /\.map$/,
  static: /\/static\//,
  other: /^(?:\/static\/js\/lib\.dll)/,
};

const filterFile = (ignored) => ([name, url]) => {
  // 忽略 .map 文件
  if (re.map.test(name)) return false;

  // 忽略非 static 下的所有文件
  if (!re.static.test(url)) {
    ignored.push(url);
    return false;
  }

  // 忽略 static/js/lib.dll 开头的文件
  if (re.other.test(name)) {
    ignored.push(url);
    return false;
  }

  return true;
};

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

  const ignored = [];

  const urls = Object.entries(files)
    .filter(filterFile(ignored))
    .map((it) => it[1]);

  const notFound = [];

  let count = 0;
  const total = urls.length;

  await Promise.all(
    urls.map((url) =>
      got.head(url).catch((er) => {
        notFound.push({ code: er.response.statusCode, url });
      }).finally(() => {
        count += 1;
        spinner.text = `${count}/${total} loading...`;
      })
    )
  );

  const endTime = Date.now();

  const msg = `done in ${(endTime - startTime) / 1000}s, succeed ${total - notFound.length}/${total} files.`;

  if (json) {
    fs.writeFileSync('report.json', JSON.stringify({ 404: notFound, 200: urls, ignored }, null, 2), 'utf8');
    spinner.succeed(`${msg} [generated report.json]`);
    return;
  }

  const msg2 = notFound.map((it) => `${it.code} ${it.url}`).join('\n');
  spinner.succeed(`${msg}\n${msg2}`);
})().catch((err) => {
  spinner.fail(`fail [${err.message}]`);
});
