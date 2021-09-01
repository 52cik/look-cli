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

(async () => {
  let files = [];

  try {
    const res = await got
      .get(`${url.replace(/\/$/, '')}/asset-manifest.json`)
      .json();
    files = res.files;
  } catch (er) {
    spinner.fail('manifest not found');
    return;
  }

  const urls = Object.entries(files)
    .filter((it) => !/\.map$/.test(it[0]))
    .filter(
      (it) =>
        !/^(service-worker\.js|index\.html|precache-manifest|\/static\/js\/lib\.dll)/.test(
          it[0]
        )
    )
    .map((it) => it[1])
    .filter((it) => !/\.map$/.test(it[0]));

  const notFound = [];

  await Promise.all(
    urls.map((url) =>
      got.head(url).catch((er) => {
        notFound.push({ code: er.response.statusCode, url });
      })
    )
  );

  const endTime = Date.now();

  if (json && notFound.length) {
    fs.writeFileSync('urls.json', JSON.stringify(notFound, null, 2), 'utf8');
    spinner.succeed(`done in ${(endTime - startTime) / 1000}s`);
    return;
  }

  const msg = notFound.map((it) => `${it.code} ${it.url}`).join('\n');
  spinner.succeed(`done in ${(endTime - startTime) / 1000}s\n${msg}`);
})().catch((err) => {
  spinner.fail(`fail [${err.message}]`);
});
