"use client";

import { Menu } from "@headlessui/react";
import { FaGlobe } from "react-icons/fa";
import { useTranslation } from "next-i18next";
import { useRouter } from "next/navigation";

export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation("common");
  const router = useRouter();

  const changeLanguage = (lang: "en" | "ru") => {
    i18n.changeLanguage(lang);
    router.refresh(); // Перезагрузит текущую страницу с новым языком
  };

  return (
    <Menu as="div" className="relative inline-block text-left">
      <Menu.Button className="flex items-center gap-1 hover:text-indigo-400 focus:outline-none">
        <FaGlobe />
        {t("chooseLanguage")}
      </Menu.Button>

      <Menu.Items
        className="absolute left-0 mt-2 w-40 bg-white text-black border border-gray-300 rounded-lg shadow-lg focus:outline-none z-50"
      >
        <Menu.Item>
          {({ active }) => (
            <button
              onClick={() => changeLanguage("en")}
              className={`block px-4 py-2 text-sm w-full text-left ${
                active ? "bg-indigo-600 text-white" : ""
              }`}
            >
              {t("english")}
            </button>
          )}
        </Menu.Item>

        <Menu.Item>
          {({ active }) => (
            <button
              onClick={() => changeLanguage("ru")}
              className={`block px-4 py-2 text-sm w-full text-left ${
                active ? "bg-indigo-600 text-white" : ""
              }`}
            >
              {t("russian")}
            </button>
          )}
        </Menu.Item>
      </Menu.Items>
    </Menu>
  );
}
