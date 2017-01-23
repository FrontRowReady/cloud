Parse.Cloud.beforeSave("UserInformation", function(request, response)
{
//    Parse.Cloud.useMasterKey();

    var o = request.object;

    /* format phone numbers */

    if (o.dirty("phoneNumber"))
    {
        if (o.get("phoneNumber") != undefined)
        {
            var string = o.get("phoneNumber");

            var numbers = extractNumbers(string);
            var formatted = formatPhoneNumber(numbers);

            o.set("phoneNumber", numbers);
            o.set("formattedPhoneNumber", formatted);
        }
        else
        {
            o.unset("phoneNumber");
            o.unset("formattedPhoneNumber");
        }
    }

    if (o.dirty("officePhoneNumber"))
    {
        if (o.get("officePhoneNumber") != undefined)
        {
            var string = o.get("officePhoneNumber");

            var numbers = extractNumbers(string);
            var formatted = formatPhoneNumber(numbers);

            o.set("officePhoneNumber", numbers);
            o.set("formattedOfficePhoneNumber", formatted);
        }
        else
        {
            o.unset("officePhoneNumber");
            o.unset("formattedOfficePhoneNumber");
        }
    }

    if (o.dirty("faxNumber"))
    {
        if (o.get("faxNumber") != undefined)
        {
            var string = o.get("faxNumber");

            var numbers = extractNumbers(string);
            var formatted = formatPhoneNumber(numbers);

            o.set("faxNumber", numbers);
            o.set("formattedFaxNumber", formatted);
        }
        else
        {
            o.unset("faxNumber");
            o.unset("formattedFaxNumber");
        }
    }

    response.success();
});


// function to extract the last 10 numbers from a string
function extractNumbers(string)
{
    var out = "";

    // regex is beyond me

    for (var i = 0; i < string.length; i++)
        if ('0' <= string[i] && string[i] <= '9')
            out += string[i];

    if (out.length > 10)
        out = out.substr(out.length-10, out.length);

    return out;
};


// function to format a string of 10 numbers to (###) ###-####
function formatPhoneNumber(string)
{
    if (string.length < 10)
        return "";

    var one = string.slice(0, 3);
    var two = string.slice(3, 6);
    var tre = string.slice(6, 10);

    var out = "(" + one + ") " + two + "-" + tre;

    return out;
};