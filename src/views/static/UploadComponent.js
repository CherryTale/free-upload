function UploadComponent({ uploadAddr }) {
    return React.createElement(
        antd.Upload,
        {
            action: uploadAddr,
            name: "uploadFiles",
            multiple: true,
            listType: "picture",
        },
        React.createElement(
            antd.Button,
            { icon: React.createElement(icons.UploadOutlined) },
            "Upload"
        )
    );
}
