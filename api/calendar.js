import { createHandler } from '../src/server.mjs';
const handle = createHandler();
export default {
  fetch(request) {
    const url = new URL(request.url);
    const routes = {calendar:'/calendario', login:'/acceso', logout:'/salir', day:'/contenido/', photo:'/foto/'};
    const route = url.searchParams.get('r');
    if (url.pathname === '/api/calendar') {
      url.pathname = Object.hasOwn(routes, route) ? routes[route] +
        (['day','photo'].includes(route) ? encodeURIComponent(url.searchParams.get('day') || '') : '') : '/';
      url.search = '';
      return handle(new Request(url, request));
    }
    return handle(request);
  }
};
