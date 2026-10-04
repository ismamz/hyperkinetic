import { index, layout, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  layout("routes/parent.tsx", [index("routes/a.tsx"), route("b", "routes/b.tsx")]),
] satisfies RouteConfig;
