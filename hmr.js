//@ts-check

const localhosts = ['localhost', '127.0.0.1', '[::1]'];
const {hostname} = location;
if(localhosts.includes(hostname)){
    window.addEventListener("focus", () => {
        location.reload();
    });
}