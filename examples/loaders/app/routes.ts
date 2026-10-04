import { route, type RouteConfig } from "@react-router/dev/routes";

export default [route(":id?", "routes/record.tsx")] satisfies RouteConfig;
