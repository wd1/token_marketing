'use strict';

const fs = require('mz/fs');
const path = require('path');
const process = require('process');

const Twig = require('twig');
const Pug = require('pug');
const minifier = require('html-minifier').minify;
const glob = require('glob');
const mkdirp = require('mkdirp');
const chalk = require('chalk');

const config = require('./contour');
const { templates, dest } = config.paths;
const minify = (process.argv[2] && process.argv[2] === 'minify') ? true : false;

const DEFAULT_LANG = 'en';

glob('translations/*.json', (error, files) => {
  files.forEach(file => {
    const lang = path.basename(file).split('.')[0];
    const pathAddition = lang === DEFAULT_LANG ? '' : '/' + lang; 
    fs.readFile(file, 'utf8').then(json => JSON.parse(json)).then(json => renderTemplates(pathAddition, json, lang));
  });
});


function renderTemplates(pathAddition, data, lang) {
  glob(`${templates}/**/*.${config.templatingLanguage}`, { ignore: ['node_modules/**', `${templates}/_*/**`] }, (error, files) => {
    files.forEach(file => {

      const fileCheck = file.split('/');
      if (fileCheck[fileCheck.length - 1].startsWith('_')) { return; }
      data['lang'] = lang === DEFAULT_LANG ? null : lang; 

      render(file, data)[config.templatingLanguage]().then(html => {
        const outputPath = file.replace(templates, dest + pathAddition).replace(`.${config.templatingLanguage}`, '.html');
        
        mkdirp(path.dirname(outputPath), error => {
          if (error) { throw error; }
          html = minify ? minifier(html, config.tasks.htmlmin.options) : html;
          fs.writeFile(outputPath, html, error => {
            if (error) { throw error; }
            console.log(`${chalk.green('✓')} ${file} ${chalk.gray('compiled to')} ${outputPath}` );
          });
        });
      });
    });
  });
}

Twig.extendFunction("importJSON", file => {
  const content = fs.readFileSync(`${templates}/data/${file}.json`, 'utf8');
  return JSON.parse(content);
});

let templateVariables = { env: minify ? 'prod' : 'dev' };

function render(file, data) {
  return {
    twig,
    pug,
    html,
  }

  function twig() {
    return new Promise((resolve, reject) => {
      Twig.renderFile(file, data, (error, html) => {
        resolve(html);
      });
    });
  }

  function pug() {
    return new Promise((resolve, reject) => resolve(Pug.renderFile(file, { contour: Object.assign(templateVariables, config.globals)  })));
  }

  function html() {
    return new Promise((resolve, reject) => {
      fs.readFile(file, 'utf8', (error, html) => {
        resolve(html);
      })
    });
  }
}
