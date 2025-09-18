# spa-ssi

Single Page App / Server Side Include Simple File Web Server

## To run

1.  Install node.js
2.  From a terminal, run:  
> node serve.js 
3.  From another package:
> npm install spa-ssi
> node ./node_modules/spa-ssi/serve.js

## Support for server-side includes:

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

## Support for SPA

If a page request doesn't resolve to a file, it defaults to /index.html

## HMR Support

Add this to index.html:

```html
<script>
    window.addEventListener("focus", () => {
        location.reload();
    });
</script>
```

