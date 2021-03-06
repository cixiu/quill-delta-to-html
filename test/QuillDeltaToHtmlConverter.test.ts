
import 'mocha';
import * as assert from 'assert';

import { DeltaInsertOp } from './../src/DeltaInsertOp';
import { OpToHtmlConverter } from './../src/OpToHtmlConverter';
import { QuillDeltaToHtmlConverter } from "./../src/QuillDeltaToHtmlConverter";
import { callWhenAlltrue, callWhenXEqualY } from './_helper';

import { delta1 } from './data/delta1';
import { GroupType } from './../src/value-types';
import { encodeHtml } from './../src/funcs-html';


describe('QuillDeltaToHtmlConverter', function () {

   describe('constructor()', function () {
      it('should instantiate return proper html', function () {

         var qdc = new QuillDeltaToHtmlConverter(delta1.ops,
            { classPrefix: 'noz' });
         var html = qdc.convert();
         assert.equal(html, delta1.html);
      });
   });

   describe("convert()", function () {
      var ops2 = [
         { insert: "this is text" },
         { insert: "\n" },
         { insert: "this is code" },
         { insert: "\n", attributes: { 'code-block': true } },
         { insert: "this is code TOO!" },
         { insert: "\n", attributes: { 'code-block': true } },
      ];

      it('should render html', function () {
         var qdc = new QuillDeltaToHtmlConverter(ops2);

         var html = qdc.convert();
         assert.equal(html.indexOf('<pre>this is code') > -1, true, html);
      });

      it('should render mention', function () {
         let ops = [
            {
               insert: "mention", attributes: {
                  mentions: true,
                  mention: {
                     'end-point': 'http://abc.com',
                     slug: 'a',
                     class: 'abc', target: '_blank'
                  }
               }
            }
         ]
         var qdc = new QuillDeltaToHtmlConverter(ops);
         var html = qdc.convert();
         assert.equal(html, ['<p><a class="abc"',
            ' href="http://abc.com/a" target="_blank"',
            '>mention</a></p>'
         ].join(""));

         var qdc = new QuillDeltaToHtmlConverter([{
            insert: 'mention', attributes: {
               mentions: true, mention: { slug: 'aa' }
            }
         }]);
         var html = qdc.convert();
         assert.equal(html, ['<p><a',
            ' href="javascript:void(0)">mention</a></p>'
         ].join(""));
      });

      it('should open and close list tags', function () {
         var ops4 = [
            { insert: "mr\n" },
            { insert: "hello" },
            { insert: "\n", attributes: { list: 'ordered' } },
            { insert: "there" },
            { insert: "\n", attributes: { list: 'bullet' } },
            { insert: "\n", attributes: { list: 'ordered' } },
         ]
         var qdc = new QuillDeltaToHtmlConverter(ops4);
         var html = qdc.convert();

         assert.equal(html.indexOf('<p>mr') > -1, true);
         assert.equal(html.indexOf('</ol><ul><li>there') > -1, true);
      });

      it('should wrap positional styles in right tag', function () {
         var ops4 = [
            { insert: "mr" },
            { insert: "\n", attributes: { align: 'center' } },
            { insert: "\n", attributes: { direction: 'rtl' } },
            { insert: "\n", attributes: { indent: 2 } }
         ]
         var qdc = new QuillDeltaToHtmlConverter(ops4, { paragraphTag: 'div' });
         var html = qdc.convert();
         assert.equal(html.indexOf('<div class="ql-align') > -1, true);
         assert.equal(html.indexOf('<div class="ql-direction') > -1, true);
         assert.equal(html.indexOf('<div class="ql-indent') > -1, true);

         var qdc = new QuillDeltaToHtmlConverter(ops4);
         var html = qdc.convert();
         assert.equal(html.indexOf('<p class="ql-align') > -1, true);
         assert.equal(html.indexOf('<p class="ql-direction') > -1, true);
         assert.equal(html.indexOf('<p class="ql-indent') > -1, true);
      });
      it('should render target attr correctly', () => {
         let ops = [
            {"attributes":{"target":"_self","link":"#"},"insert":"A"},
            {"attributes":{"target":"_blank","link":"#"},"insert":"B"},
            {"attributes":{"link":"#"},"insert":"C"},{"insert":"\n"}
         ];
         let qdc = new QuillDeltaToHtmlConverter(ops, {linkTarget: ''});
         let html = qdc.convert();
         assert.equal(html, [
            `<p><a href="#" target="_self">A</a>`,
            `<a href="#" target="_blank">B</a>`,
            `<a href="#">C</a></p>`
         ].join(''));
         
         qdc = new QuillDeltaToHtmlConverter(ops);
         html = qdc.convert();
         assert.equal(html, [
            `<p><a href="#" target="_self">A</a>`,
            `<a href="#" target="_blank">B</a>`,
            `<a href="#" target="_blank">C</a></p>`
         ].join(''));

         qdc = new QuillDeltaToHtmlConverter(ops, {linkTarget: '_top'});
         html = qdc.convert();
         assert.equal(html, [
            `<p><a href="#" target="_self">A</a>`,
            `<a href="#" target="_blank">B</a>`,
            `<a href="#" target="_top">C</a></p>`
         ].join(''));
      });
   });

   describe('custom types', () => {
      it(`should return empty string if renderer not defined for
                           custom blot`, () => {
         let ops = [
            { insert: { customstuff: 'my val' } }
         ];
         let qdc = new QuillDeltaToHtmlConverter(ops);
         assert.equal(qdc.convert(), '<p></p>');
      });
      it('should render custom insert types with given renderer', () => {
         let ops = [
            { insert: { bolditalic: 'my text' } },
            { insert: { blah: 1 } }
         ];
         let qdc = new QuillDeltaToHtmlConverter(ops);
         qdc.renderCustomWith((op, ctx) => {
            if (op.insert.type === 'bolditalic') {
               return '<b><i>' + op.insert.value + '</i></b>';
            }
            return 'unknown';
         });
         let html = qdc.convert();
         assert.equal(html, '<p><b><i>my text</i></b>unknown</p>');
      });

      it('should render custom insert types in code blocks with given renderer', () => {
         let ops = [
            { insert: { colonizer: ':' }},
            { insert: "\n", attributes: { 'code-block': true } },
            { insert: "code1"},
            { insert: "\n", attributes: { 'code-block': true } },
            { insert: { colonizer: ':' }},
            { insert: "\n", attributes: { 'code-block': true } }
         ];
         let renderer = (op: DeltaInsertOp, ctx: DeltaInsertOp) => {
            if (op.insert.type === 'colonizer') {
               return  op.insert.value;
            }
            return '';
         };
         let qdc = new QuillDeltaToHtmlConverter(ops.slice(0,2));
         qdc.renderCustomWith(renderer);
         assert.equal(qdc.convert(), '<pre>:</pre>');

         qdc = new QuillDeltaToHtmlConverter(ops);
         qdc.renderCustomWith(renderer);
         assert.equal(qdc.convert(), '<pre>:\ncode1\n:</pre>');
      });

      it('should render custom insert types in headers with given renderer', () => {
         let ops = [
            { insert: { colonizer: ':' }},
            { insert: "\n", attributes: { header: 1 } },
            { insert: "hello"},
            { insert: "\n", attributes: { header: 1 } },
            { insert: { colonizer: ':' }},
            { insert: "\n", attributes: { header: 1 } }
         ];
         let renderer = (op: DeltaInsertOp, ctx: DeltaInsertOp) => {
            if (op.insert.type === 'colonizer') {
               return  op.insert.value;
            }
            return '';
         };
         let qdc = new QuillDeltaToHtmlConverter(ops.slice(0,2));
         qdc.renderCustomWith(renderer);
         assert.equal(qdc.convert(), '<h1>:</h1>');

         qdc = new QuillDeltaToHtmlConverter(ops);
         qdc.renderCustomWith(renderer);
         assert.equal(qdc.convert(), '<h1>:<br/>hello<br/>:</h1>');
      });
   });

   describe('getListTag()', function () {

      it('should return proper list tag', function () {
         var op = new DeltaInsertOp("\n", { list: 'ordered' });
         var qdc = new QuillDeltaToHtmlConverter(delta1.ops)
         assert.equal(qdc.getListTag(op), 'ol');

         var op = new DeltaInsertOp("\n", { list: 'bullet' });
         assert.equal(qdc.getListTag(op), 'ul');

         var op = new DeltaInsertOp("d");
         assert.equal(qdc.getListTag(op), '');

      });
   });

   describe(' prepare data before inline and block renders', function () {
      var ops: any;
      beforeEach(function () {
         ops = [
            { insert: 'Hello' },
            { insert: ' my ', attributes: { italic: true } },
            { insert: '\n', attributes: { italic: true } },
            { insert: ' name is joey' }
         ].map((v: any) => new DeltaInsertOp(v.insert, v.attributes));
      });

      describe('renderInlines()', function () {
         it('should render inlines', function () {
            var qdc = new QuillDeltaToHtmlConverter([]);
            var inlines = qdc.renderInlines(ops);
            assert.equal(inlines, ['<p>Hello',
               '<em> my </em><br/> name is joey</p>'].join(''));

            qdc = new QuillDeltaToHtmlConverter([], { paragraphTag: 'div' });
            var inlines = qdc.renderInlines(ops);
            assert.equal(inlines,
               '<div>Hello<em> my </em><br/> name is joey</div>');

            qdc = new QuillDeltaToHtmlConverter([], { paragraphTag: '' });
            var inlines = qdc.renderInlines(ops);
            assert.equal(inlines, 'Hello<em> my </em><br/> name is joey');
         });

         it('should render plain new line string', function () {
            var ops = [new DeltaInsertOp("\n")];
            var qdc = new QuillDeltaToHtmlConverter([]);
            assert.equal(qdc.renderInlines(ops), '<p><br/></p>');
         });

         it('should render styled new line string', function () {
            var ops = [new DeltaInsertOp("\n", { font: 'arial' })];
            var qdc = new QuillDeltaToHtmlConverter([]);
            assert.equal(qdc.renderInlines(ops),
               '<p><br/></p>');

            var qdc = new QuillDeltaToHtmlConverter([], { paragraphTag: '' });
            assert.equal(qdc.renderInlines(ops), '<br/>');
         });

         it('should render when first line is new line', function () {
            var ops = [new DeltaInsertOp("\n"), new DeltaInsertOp("aa")];
            var qdc = new QuillDeltaToHtmlConverter([]);
            assert.equal(qdc.renderInlines(ops), '<p><br/>aa</p>');
         });

         it('should render when last line is new line', function () {
            var ops = [new DeltaInsertOp("aa"), new DeltaInsertOp("\n")];
            var qdc = new QuillDeltaToHtmlConverter([]);
            assert.equal(qdc.renderInlines(ops), '<p>aa</p>');
         });

         it('should render mixed lines', function () {
            var ops = [new DeltaInsertOp("aa"), new DeltaInsertOp("bb")];
            var nlop = new DeltaInsertOp("\n");
            var stylednlop = new DeltaInsertOp("\n", { color: '#333', italic: true });
            var qdc = new QuillDeltaToHtmlConverter([]);
            assert.equal(qdc.renderInlines(ops), '<p>aabb</p>');

            var ops0 = [nlop, ops[0], nlop, ops[1]]
            assert.equal(qdc.renderInlines(ops0), '<p><br/>aa<br/>bb</p>');

            var ops4 = [ops[0], stylednlop, stylednlop, stylednlop, ops[1]]
            assert.equal(qdc.renderInlines(ops4),
               ['<p>aa<br/><br/><br/>bb</p>'].join(''));
         });

      });

      describe('renderBlock()', function () {
         var op = new DeltaInsertOp('\n', { header: 3, indent: 2 });
         var inlineop = new DeltaInsertOp("hi there");
         it('should render container block', function () {

            var qdc = new QuillDeltaToHtmlConverter([]);
            var blockhtml = qdc.renderBlock(op, [inlineop]);
            assert.equal(blockhtml, ['<h3 class="ql-indent-2">',
               'hi there</h3>'].join(''));

            var qdc = new QuillDeltaToHtmlConverter([]);
            var blockhtml = qdc.renderBlock(op, []);
            assert.equal(blockhtml, ['<h3 class="ql-indent-2">',
               '<br/></h3>'].join(''));

         });

         it('should correctly render code block', function () {
            let ops = [
               {
                  "insert": "line 1"
               },
               {
                  "attributes": {
                     "code-block": true
                  },
                  "insert": "\n"
               },
               {
                  "insert": "line 2"
               },
               {
                  "attributes": {
                     "code-block": true
                  },
                  "insert": "\n"
               },
               {
                  "insert": "line 3"
               },
               {
                  "attributes": {
                     "code-block": true
                  },
                  "insert": "\n"
               },
               {
                  "insert": "<p>line 4</p>"
               },
               {
                  "attributes": {
                     "code-block": true
                  },
                  "insert": "\n"
               }
            ]
            console.log(encodeHtml("<p>line 4</p>"));
            var qdc = new QuillDeltaToHtmlConverter(ops);
            let html = qdc.convert();
            assert.equal(html, ["<pre>line 1\nline 2\nline 3\n", 
               encodeHtml("<p>line 4</p>"), 
               "</pre>"].join("")
            );

            qdc = new QuillDeltaToHtmlConverter(ops, {
               multiLineCodeblock: false
            });
            html = qdc.convert();
            assert.equal(
               '<pre>line 1</pre><pre>line 2</pre><pre>line 3</pre>'+
               '<pre>'+ encodeHtml("<p>line 4</p>") + '</pre>',
               html);
            qdc = new QuillDeltaToHtmlConverter([ops[0], ops[1]]);
            html = qdc.convert();
            assert.equal(html, '<pre>line 1</pre>');

         });
      });

      describe('before n after renders()', function () {
         var ops = [
            { insert: 'hello', attributes: { bold: true } },
            { insert: '\n', attributes: { bold: true } },
            { insert: 'how r u?' },
            { insert: 'r u fine' },
            { insert: '\n', attributes: { blockquote: true } },
            { insert: { video: 'http://' } },
            { insert: 'list item 1' },
            { insert: '\n', attributes: { list: 'bullet' } },
            { insert: 'list item 1 indented' },
            { insert: '\n', attributes: { list: 'bullet', indent: 1 } }
         ]
         var qdc = new QuillDeltaToHtmlConverter(ops);

         it('should call before/after render callbacks ', function (done) {
            let status = {x:0, y:8};
            qdc.beforeRender((groupType, data) => {
               if (groupType === GroupType.InlineGroup) {
                  var op = (<any>data).ops[0];
                  assert.ok(op.attributes.bold);
               } else if (groupType === GroupType.Video) {
                  var op = (<any>data).op;
                  assert.ok(op.insert.type === 'video');
               } else if (groupType === GroupType.Block) {
                  var d = (<any>data);
                  assert.ok(d.op.attributes.blockquote && d.ops.length === 2);
               } else {
                  var d = (<any>data);
                  assert.ok(d.items.length === 1);
               }
               status.x++;
               return '';
            });
            qdc.afterRender((groupType, html) => {
               if (groupType === GroupType.InlineGroup) {
                  assert.ok(html.indexOf('<strong>hello') > -1);
               } else if (groupType === GroupType.Video) {
                  assert.ok(html.indexOf('<iframe') > -1);
               } else if (groupType === GroupType.Block) {
                  assert.ok(html.indexOf('<blockquote') > -1);
               } else {
                  assert.ok(html.indexOf('list item 1<ul><li') > -1);
               }
               status.x++;
               return html;
            });
            qdc.convert();
            callWhenXEqualY(status, done);
         });

         it(`should call before render with block grouptype for align
                  indent and direction`, (done) => {
            let ops = [
               {insert: 'align'},
               {insert: '\n', attributes: {align: 'right'}},
               {insert: 'rtl'},
               {insert: '\n', attributes: {direction: 'rtl'}},
               {insert: 'indent 1'},
               {insert: '\n', attributes: {indent: 1}},
            ];
            let status = {x:0, y: 3};
            let qdc = new QuillDeltaToHtmlConverter(ops);
            qdc.beforeRender((gtype: any, data: any) => {
               gtype === 'block' && status.x++;
               return '';
            });
            qdc.convert();
            callWhenXEqualY(status, done);
         });

         it('should use my custom html if I return from before call back', function () {

            var c = new QuillDeltaToHtmlConverter([
               { insert: { video: "http" } }, { insert: 'aa' }]);
            c.beforeRender(() => {
               return '<my custom video html>';
            });
            var v = c.convert();
            assert.ok(v.indexOf('<my custom') > - 1);
         });

         it('should register and use callbacks if they are functions', function () {
            var jobstatus = [false, false];
            var c = new QuillDeltaToHtmlConverter([
               { insert: { video: "http" } }, { insert: 'aa' }]);
            var dummy = (): any => '';

            c.beforeRender(dummy());
            c.afterRender(dummy());
            v = c.convert();
            assert.ok(v.indexOf('iframe') > -1);

            c.beforeRender(dummy);
            var v = c.convert();
            assert.ok(v.indexOf('<iframe') > - 1 && v.indexOf('aa') > -1);

            c.afterRender(dummy);
            v = c.convert();
            assert.ok(v === '');


         });
      });
   });
});
