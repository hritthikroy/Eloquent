// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "Eloquent",
    platforms: [.macOS(.v14)],
    dependencies: [
        .package(url: "https://github.com/soffes/HotKey", branch: "main")
    ],
    targets: [
        .executableTarget(
            name: "Eloquent",
            dependencies: [
                .product(name: "HotKey", package: "HotKey")
            ],
            path: ".",
            exclude: ["Info.plist", "Eloquent.entitlements", "README.md", "Package.swift", "EloquentTests.swift"],
            resources: [
                .process("Utilities/Resources")
            ]
        )
    ]
)