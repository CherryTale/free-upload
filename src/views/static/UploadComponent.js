function UploadComponent({ uploadAddr, uploadedFiles }) {
    console.log(uploadedFiles);
    return React.createElement(
        antd.Upload,
        {
            action: uploadAddr,
            name: "uploadFiles",
            multiple: true,
            listType: "picture",
            defaultFileList: JSON.parse(uploadedFiles),
        },
        React.createElement(
            antd.Button,
            { icon: React.createElement(icons.UploadOutlined) },
            "Upload"
        )
    );
}
