# MARD Bead Pattern

纯静态 MARD 拼豆图纸生成器，适合部署到 GitHub Pages。

## 使用

1. 打开网页后上传 PNG/JPG。
2. 选择 `Pixel-art` 或 `Photo` 模式。
3. 选择 `29x29`、`58x58`、`87x87` 或自定义尺寸。
4. 生成并下载网格 PNG、色号 PNG、图例 PNG、材料 CSV 或打印 PDF。

图片处理都在浏览器本地完成，不上传到服务器。

## 本地预览

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

然后打开 <http://127.0.0.1:4173/>。

## GitHub Pages

新建 GitHub 仓库 `mard-bead-pattern` 后，将本目录推送到 `main` 分支。在仓库 Settings -> Pages 中选择：

- Source: Deploy from a branch
- Branch: `main`
- Folder: `/root`

发布后地址为 `https://CrispBiscuit.github.io/mard-bead-pattern/`。
