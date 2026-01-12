# Capacitor 및 네이티브 브릿지 보호
-keepattributes Signature
-keepattributes *Annotation*
-keepattributes SourceFile,LineNumberTable
-keep public class com.getcapacitor.** { *; }
-keep public class * extends com.getcapacitor.Plugin
-keep public class * extends com.getcapacitor.BridgeActivity
-keep class com.getcapacitor.Bridge { *; }
-keep class com.getcapacitor.MessageHandler { *; }

# WebView 및 JavaScript 인터페이스 보호
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# AdMob (Google Mobile Ads) 관련 규칙
-keep class com.google.android.gms.ads.** { *; }
-keep class com.google.ads.** { *; }

# Stack Trace 복구를 위한 설정
-renamesourcefileattribute SourceFile
-keepattributes SourceFile,LineNumberTable
