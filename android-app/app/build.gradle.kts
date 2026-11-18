plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val generatedAssetsDir = layout.buildDirectory.dir("generated/extensionAssets")
val generatedResDir = layout.buildDirectory.dir("generated/extensionRes")
val extensionRoot = rootProject.projectDir.parentFile

val syncExtensionAssets by tasks.registering(Copy::class) {
    from(extensionRoot) {
        include(
            "*.html",
            "*.xlsx",
            "*.json",
            "css/**",
            "script/**",
            "lib/**",
            "Assets/**"
        )
    }
    into(generatedAssetsDir.map { it.dir("extension") })
}

val syncExtensionIcon by tasks.registering(Copy::class) {
    from(File(extensionRoot, "Assets/128.png"))
    into(generatedResDir.map { it.dir("drawable") })
    rename { "ic_nikshay_logo.png" }
}

android {
    namespace = "com.nikshay.manager"
    compileSdk = 34
    buildToolsVersion = "34.0.0"

    defaultConfig {
        minSdk = 24
        targetSdk = 34
        versionCode = 220
        versionName = "V2.2.0"
    }

    flavorDimensions += "edition"
    productFlavors {
        create("automation") {
            dimension = "edition"
            applicationId = "com.nikshay.automation"
            resValue("string", "app_name", "Ni-Kshay Automation")
        }
        create("manager") {
            dimension = "edition"
            applicationId = "com.nikshay.admin"
            resValue("string", "app_name", "Ni-Kshay Manager")
        }
    }

    signingConfigs {
        create("release") {
            val ks = rootProject.file("nikshay-release.jks")
            if (ks.exists()) {
                storeFile = ks
                storePassword = "nikshay2026"
                keyAlias = "nikshay"
                keyPassword = "nikshay2026"
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    sourceSets {
        getByName("main") {
            assets.srcDirs("src/main/assets", generatedAssetsDir)
            res.srcDirs("src/main/res", generatedResDir)
        }
    }
}

tasks.named("preBuild").configure {
    dependsOn(syncExtensionAssets, syncExtensionIcon)
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.activity:activity-ktx:1.9.0")
}
