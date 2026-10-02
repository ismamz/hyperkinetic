import gsap from "gsap";
import { CustomEase } from "gsap/CustomEase";

gsap.registerPlugin(CustomEase);

CustomEase.create("im-quint-inout", ".76, 0, .2, 1");
CustomEase.create("im-quart-inout", "0.65, 0.01, 0.05, 0.99");
