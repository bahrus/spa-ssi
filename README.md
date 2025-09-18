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
    import 'spa-ssi/hmr.js';
</script>
```



## Directory Listing support

/sitemap lists all the html links within the site.

