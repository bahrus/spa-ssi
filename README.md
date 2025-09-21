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

```html
<!doctype html>
<html>
  <head>
    <title>Test of JS Include</title>
  </head>
  <body>
    <!--#include virtual="about.mjs"-->
  </body>
</html>
```

The assumption is that such files have an export function called "render".

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

