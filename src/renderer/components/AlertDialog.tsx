import { useState, forwardRef, useImperativeHandle } from "react";
import { FlexBox, FlexBoxJustifyContent, Button, Text, Dialog } from "@ui5/webcomponents-react";


export type AlertDialogRef = {
    show: (msg: string) => void;
};

const AlertDialog = forwardRef<AlertDialogRef>((_, ref) => {
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");

    useImperativeHandle(ref, () => ({
        show: (msg: string) => {
            setMessage(msg);
            setOpen(true);
        }
    }));

    return (
        <Dialog
            open={open}
            headerText=""
            footer={
                <FlexBox
                    justifyContent={FlexBoxJustifyContent.End}
                    style={{ width: "100%" }}
                >
                    <Button onClick={() => setOpen(false)}>Confirm</Button>
                </FlexBox>
            }
            onClose={() => setOpen(false)}
            style={{ width: "10vw", height: "15vh" }}
        >
            <div
                style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "100%",
                    textAlign: "center"
                }}
            >
                <Text style={{ fontSize: "1.0rem", fontWeight: "normal" }}>
                    {message}
                </Text>
            </div>
        </Dialog>


    );
});

export default AlertDialog;
