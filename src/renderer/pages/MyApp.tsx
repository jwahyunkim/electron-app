// src/renderer/pages/MyApp.tsx
import { useEffect, useState } from 'react'
import { Card, Text, TabContainer, Tab, Icon } from '@ui5/webcomponents-react'
import factory from '@ui5/webcomponents-icons/dist/factory.js'
import { useNavigate } from 'react-router-dom'
import * as cfg from "../../common/config";
import { initI18n, t } from "../utils/i18n";

export function MyApp(): JSX.Element | null {
    const navigate = useNavigate()

    // i18n 번들 로딩 (UI 구조는 그대로, 텍스트만 치환)
    const [i18nReady, setI18nReady] = useState(false)
    useEffect(() => {
        let mounted = true;
        (async () => {
            await initI18n()
            if (mounted) setI18nReady(true)
        })()
        return () => { mounted = false; };
    }, []);

    if (!i18nReady) return null; // 번들 준비 전 잠깐 숨김(깜빡임 방지)

    return (
        <div style={{ padding: "1rem" }}>
            <TabContainer collapsed={false}>
                <Tab text="QM">
                    <div style={{ padding: "1rem", minHeight: "1600px" }}>
                        <Text style={{ fontSize: "1.5rem", fontWeight: "bold" }}>
                            QM
                        </Text>
                        <div
                            style={{
                                display: "flex",
                                flexWrap: "wrap",
                                marginTop: "1rem",
                            }}
                        >
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
                                    // if (!plantCode) {
                                    //     alert("Config 값을 입력해주세요");
                                    // } else {
                                    navigate("./defect");
                                    // }
                                }}
                            >
                                <Text style={{ fontWeight: "bold", fontSize: "1rem", margin: "1rem" }}>
                                    E_ScanDefect
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
                                    // if (!plantCode) {
                                    //     alert("Config 값을 입력해주세요");
                                    // } else {
                                    navigate("./upcdefect");
                                    // }
                                }}
                            >
                                <Text style={{ fontWeight: "bold", fontSize: "1rem", margin: "1rem" }}>
                                    UPC Defect Register
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


                        </div>
                    </div>
                </Tab>
            </TabContainer>
        </div>
    );
}
