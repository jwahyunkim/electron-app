// src/renderer/pages/MyApp.tsx
import React, { useEffect, useState } from "react";
import {
  Card,
  Text,
  TabContainer,
  Tab,
  Icon,
} from "@ui5/webcomponents-react";
import actionSettingsIcon from "@ui5/webcomponents-icons/dist/action-settings.js";
import factory from "@ui5/webcomponents-icons/dist/factory.js";
import { useNavigate } from "react-router-dom";
import * as cfg from "../../common/config";

import { initI18n, t } from "../utils/i18n";

export function MyApp() {
  const navigate = useNavigate();

  // i18n 번들 로딩 (UI 구조는 그대로, 텍스트만 치환)
  const [i18nReady, setI18nReady] = useState(false);
  useEffect(() => {
    let mounted = true;
    (async () => {
      await initI18n();
      if (mounted) setI18nReady(true);
    })();
    return () => { mounted = false; };
  }, []);

  if (!i18nReady) return null; // 번들 준비 전 잠깐 숨김(깜빡임 방지)

  return (
    <div style={{ padding: "1rem" }}>
      <TabContainer collapsed={false}>
        {/* ===== 탭 1: DM ME ===== */}
        <Tab text={t("home.tab.dmMe")}>
          <div style={{ padding: "1rem", minHeight: "1600px" }}>
            <Text style={{ fontSize: "1.5rem", fontWeight: "bold" }}>
              {t("home.title.dmMe")}
            </Text>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                marginTop: "1rem",
              }}
            >
              {/* E_Scan 메인 진입 */}
              <Card
                style={{
                  width: "180px",
                  height: "180px",
                  margin: "1rem",
                  borderRadius: "8px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
                  cursor: "pointer",
                  position: "relative"
                }}
                onClick={() => {
                  if (!cfg.PLANT) {
                    alert(t("app.err.configRequired"));
                  } else {
                    navigate("./outgoing");
                  }
                }}
              >
                <Text style={{ fontWeight: "bold", fontSize: "1rem", margin: "1rem" }}>
                  {t("home.card.eScanProd")}
                </Text>
                <Icon
                  name={factory}
                  style={{
                    width: "2rem",
                    height: "2rem",
                    position: "absolute",
                    bottom: "1.5rem",
                    left: "1.5rem",
                    color: "#0a6ed1",
                  }}
                />
              </Card>

              {/* ★ E_Scan 재출력 */}
              <Card
                style={{
                  width: "180px",
                  height: "180px",
                  margin: "1rem",
                  borderRadius: "8px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
                  cursor: "pointer",
                  position: "relative"
                }}
                onClick={() => {
                  if (!cfg.PLANT) {
                    alert(t("app.err.configRequired"));
                  } else {
                    navigate("./outgoing/reprint");
                  }
                }}
              >
                <Text style={{ fontWeight: "bold", fontSize: "1rem", margin: "1rem", textAlign: "center" }}>
                  {t("home.card.eScanReprint")}
                </Text>
                <Icon
                  name={actionSettingsIcon}
                  style={{
                    width: "2rem",
                    height: "2rem",
                    position: "absolute",
                    bottom: "1.5rem",
                    left: "1.5rem",
                    color: "#0a6ed1",
                  }}
                />
              </Card>
            </div>
          </div>
        </Tab>

        {/* ===== 탭 2: 인터페이스 ===== */}
        <Tab text={t("home.tab.interface")}>
          <div style={{ padding: "1rem", minHeight: "600px" }}>
            <Text style={{ fontSize: "1.5rem", fontWeight: "bold" }}>
              {t("home.title.interface")}
            </Text>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                marginTop: "1rem",
              }}
            >
              {/* 제조오더 생성 */}
              <Card
                style={{
                  width: "180px",
                  height: "180px",
                  margin: "1rem",
                  borderRadius: "8px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
                  cursor: "pointer",
                  position: "relative"
                }}
                onClick={() => {
                  if (!cfg.PLANT) {
                    alert(t("app.err.configRequired"));
                  } else {
                    navigate("./interface/order");
                  }
                }}
              >
                <Text style={{ fontWeight: "bold", fontSize: "1rem", margin: "1rem" }}>
                  {t("home.card.createOrder")}
                </Text>
                <Icon
                  name={factory}
                  style={{
                    width: "2rem",
                    height: "2rem",
                    position: "absolute",
                    bottom: "1.5rem",
                    left: "1.5rem",
                    color: "#0a6ed1",
                  }}
                />
              </Card>

              {/* SFC 변경 */}
              <Card
                style={{
                  width: "180px",
                  height: "180px",
                  margin: "1rem",
                  borderRadius: "8px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
                  cursor: "pointer",
                  position: "relative"
                }}
                onClick={() => {
                  if (!cfg.PLANT) {
                    alert(t("app.err.configRequired"));
                  } else {
                    navigate("./interface/change");
                  }
                }}
              >
                <Text style={{ fontWeight: "bold", fontSize: "1rem", margin: "1rem" }}>
                  {t("home.card.changeSfc")}
                </Text>
                <Icon
                  name={factory}
                  style={{
                    width: "2rem",
                    height: "2rem",
                    position: "absolute",
                    bottom: "1.5rem",
                    left: "1.5rem",
                    color: "#0a6ed1",
                  }}
                />
              </Card>

              {/* ★ 통합테스트인터페이스 */}
              <Card
                style={{
                  width: "180px",
                  height: "180px",
                  margin: "1rem",
                  borderRadius: "8px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
                  cursor: "pointer",
                  position: "relative"
                }}
                onClick={() => {
                  if (!cfg.PLANT) {
                    alert(t("app.err.configRequired"));
                  } else {
                    navigate("./interface/total");
                  }
                }}
              >
                <Text
                  style={{
                    fontWeight: "bold",
                    fontSize: "1rem",
                    margin: "1rem",
                    textAlign: "center",
                  }}
                >
                  {t("home.card.totalInterface", { defaultValue: "통합테스트인터페이스" })}
                </Text>

                <Icon
                  name={actionSettingsIcon}
                  style={{
                    width: "2rem",
                    height: "2rem",
                    position: "absolute",
                    bottom: "1.5rem",
                    left: "1.5rem",
                    color: "#0a6ed1",
                  }}
                />
              </Card>
            </div>
          </div>
        </Tab>
      </TabContainer>
    </div>
  );
}
