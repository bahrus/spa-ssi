# spa-ssi

Single Page App / Server Side Include Simple File Web Server

## To run

1.  Install node.js
2.  From a terminal, run: 

\> node serve.js 

3.  From another package:

\> npm install -d spa-ssi

\> node ./node_modules/spa-ssi/serve.js

4. Open http://localhost:8000

## Support for server-side html includes:

```html
<!doctype html>
<html>
  <head>
    <title>ssi_server demo</title>
  </head>
  <body>
    <!--#include virtual="about.html"-->
  </body>
</html>
```

## Support for server-side js includes:

In the example above, if "about.html" is not found, it tries "about.mjs" from the root folder of the web site.

The assumption is that such files have an export function called "render".

## Support for special *.mjs references

Along the lines of the previous section, if:

1. Any reference is made to a file with extension *.mjs, and
2. That javascript exports a function called "render" which expects no arguments, then
3. If render() returns a string starting with "<", it will provide mime type text/html and render the content as HTML
4. Else if render() returns a string starting with either "[" or "{", it will provide mime type application/json and render the content as JSOn
5. Else it will render the content as plain text.

## Support for SPA

If a page request doesn't resolve to a file, it defaults to /index.html

## HMR Support

Okay, it isn't true HMR, but in my experience it is as good as.

Add this to index.html:

```html
<script>
    const localhosts = ['localhost', '127.0.0.1', '[::1]'];
    const {hostname} = location;
    if(localhosts.includes(hostname)){
        window.addEventListener("focus", () => {
            location.reload();
        });
    }
</script>
```

or:

```html
<script type=module>
    import '/node_modules/spa-ssi/hmr.js';
</script>
```

or:

```html
<script type=importmap >
    {
        "imports": {
            ...
            "spa-ssi/": "/node_modules/spa-ssi/",
            ...
        }
    }
</script>
<script type=module>
    import 'spa-ssi/hmr.js';
</script>
```


## Directory Listing support

http://locahost:8000/sitemap lists all the html links within the site.

